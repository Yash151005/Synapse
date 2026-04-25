// OpenAI — Realtime voice ONLY (per locked stack rule).
// This module exposes embedding helpers (text-embedding-3-small) for
// agent semantic discovery, and a thin Realtime session-token endpoint
// helper used by the voice bridge. The Realtime WS itself is proxied
// by apps/voice-bridge — no direct browser→OpenAI sockets here.

import OpenAI from "openai";

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("[openai] Missing OPENAI_API_KEY");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

export async function embedText(input: string): Promise<number[]> {
  const r = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  const vec = r.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMS) {
    throw new Error(`[openai] Unexpected embedding length: ${vec?.length}`);
  }
  return vec;
}

export async function embedMany(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const r = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: inputs,
  });
  return r.data.map((d) => d.embedding);
}

/**
 * Mints an ephemeral Realtime session token the browser can hand to the
 * voice bridge for direct streaming. Lifetime is short (a few minutes) by
 * design — rotate per session.
 */
export async function createRealtimeSession(opts?: {
  voice?: "alloy" | "echo" | "shimmer" | "ash" | "sage" | "coral";
  instructions?: string;
}) {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      voice: opts?.voice ?? "ash",
      instructions:
        opts?.instructions ??
        "You are Synapse, a voice-first orchestrator. Listen to the user's goal, respond briefly while the agents work, and narrate the final result.",
    }),
  });
  if (!r.ok) {
    throw new Error(`[openai/realtime] ${r.status}: ${await r.text()}`);
  }
  return r.json() as Promise<{ id: string; client_secret: { value: string; expires_at: number } }>;
}
