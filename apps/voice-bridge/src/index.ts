/**
 * apps/voice-bridge/src/index.ts
 *
 * Fastify WebSocket server that proxies the browser's OpenAI Realtime
 * stream through a trusted backend. This avoids embedding the API key
 * in the client and allows server-side logging/monitoring of voice sessions.
 *
 *   pnpm dev:bridge
 *
 * Listens on PORT (default 8080) for WebSocket connections at /ws/realtime.
 * Each client connection gets a dedicated tunnel to OpenAI's Realtime API.
 */

import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
loadEnv({ path: path.join(ROOT, ".env.local") });
loadEnv({ path: path.join(ROOT, "../../.env.local") });
loadEnv({ path: path.join(ROOT, "../../apps/web/.env.local") });

const PORT = parseInt(process.env.VOICE_BRIDGE_PORT ?? "8080", 10);
const WS_BUFFER_SIZE = 100 * 1024; // 100 KB

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

// Register WebSocket support
await fastify.register(fastifyWebsocket);

/**
 * POST /health
 * Readiness/liveness probe for orchestrators (k8s, systemd, etc.)
 */
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

/**
 * WS /ws/realtime
 *
 * Browser connects here with a session_token from the web app's OpenAI token endpoint.
 * We proxy all frames to/from OpenAI's realtime API, logging metadata.
 *
 * Query params:
 *   - session_token: from OpenAI token endpoint response.client_secret.value
 *   - session_id: (optional) for logging/correlation
 */
fastify.register(async (fastify) => {
  fastify.get("/ws/realtime", { websocket: true }, async (socket, request) => {
    const sessionId = (request.query as Record<string, string>).session_id ?? "unknown";
    const sessionToken = (request.query as Record<string, string>).session_token;

    if (!sessionToken) {
      fastify.log.warn(`[${sessionId}] Missing session_token, closing`);
      socket.close(1002, "Missing session_token");
      return;
    }

    fastify.log.info(`[${sessionId}] Client connected, tunneling to OpenAI Realtime`);

    let openaiSocket: WebSocket | null = null;
    let clientClosed = false;
    let openaiClosed = false;

    try {
      // Open tunnel to OpenAI
      const openaiUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
      openaiSocket = new WebSocket(openaiUrl, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      // Handle incoming frames from client → OpenAI
      socket.on("message", (data: WebSocket.Data) => {
        if (openaiSocket?.readyState === WebSocket.OPEN) {
          openaiSocket.send(data, (err: Error | undefined) => {
            if (err) {
              fastify.log.error({ err }, `[${sessionId}] Error sending to OpenAI`);
            }
          });
        }
      });

      // Handle incoming frames from OpenAI → client
      openaiSocket.on("message", (data: WebSocket.Data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data, (err: Error | undefined) => {
            if (err) {
              fastify.log.error({ err }, `[${sessionId}] Error sending to client`);
            }
          });
        }
      });

      // Lifecycle handlers
      openaiSocket.on("open", () => {
        fastify.log.info(`[${sessionId}] OpenAI tunnel established`);
      });

      openaiSocket.on("close", (code: number, reason: Buffer) => {
        openaiClosed = true;
        fastify.log.info(`[${sessionId}] OpenAI closed (code=${code}, reason=${reason})`);
        if (!clientClosed && socket.readyState === WebSocket.OPEN) {
          socket.close(1000, reason?.toString() ?? "OpenAI closed");
        }
      });

      openaiSocket.on("error", (err: Error) => {
        fastify.log.error({ err }, `[${sessionId}] OpenAI error`);
      });

      socket.on("close", (code: number, reason: Buffer) => {
        clientClosed = true;
        fastify.log.info(`[${sessionId}] Client closed (code=${code})`);
        if (!openaiClosed && openaiSocket?.readyState === WebSocket.OPEN) {
          openaiSocket.close(1000, reason?.toString() ?? "Client closed");
        }
      });

      socket.on("error", (err: Error) => {
        fastify.log.error({ err }, `[${sessionId}] Client error`);
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      fastify.log.error({ err }, `[${sessionId}] Setup error: ${errMsg}`);
      socket.close(1011, "Internal server error");
    }
  });
});

/**
 * Global error handler
 */
fastify.setErrorHandler((error: Error, request, reply) => {
  const msg = error instanceof Error ? error.message : String(error);
  fastify.log.error(`[${request.url}] ${msg}`);
  reply.statusCode = 500;
  reply.send({ error: msg });
});

// Start server
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`✔ voice-bridge listening on ws://0.0.0.0:${PORT}`);
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  fastify.log.error(`Failed to start voice-bridge: ${errMsg}`);
  process.exit(1);
}
