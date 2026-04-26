# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:20-bookworm-slim

# ── base: pnpm toolchain ──────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ── deps: install only what voice-bridge needs ────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/voice-bridge/package.json apps/voice-bridge/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm --filter @synapse/voice-bridge... install --frozen-lockfile

# ── builder: compile TypeScript ───────────────────────────────────────────────
FROM deps AS builder
COPY apps/voice-bridge/src         apps/voice-bridge/src
COPY apps/voice-bridge/tsconfig.json apps/voice-bridge/tsconfig.json
COPY packages/shared               packages/shared
RUN pnpm --filter @synapse/voice-bridge build

# ── runner: lean production image ────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app/apps/voice-bridge

ENV NODE_ENV=production
ENV VOICE_BRIDGE_PORT=8080

# pnpm puts top-level dep symlinks in the package-local node_modules, with
# the actual files inside /app/node_modules/.pnpm. Both must be present.
COPY --from=builder /app/node_modules                    /app/node_modules
COPY --from=builder /app/apps/voice-bridge/node_modules  ./node_modules
COPY --from=builder /app/apps/voice-bridge/dist          ./dist
COPY --from=builder /app/apps/voice-bridge/package.json  ./package.json

EXPOSE 8080
CMD ["node", "dist/index.js"]
