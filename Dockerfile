# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm --filter @synapse/web... install --frozen-lockfile

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .

RUN pnpm --filter @synapse/web build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SYNAPSE_VOLUME_DIR=/data

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data /app/apps/web/public \
  && chown -R nextjs:nodejs /data /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
