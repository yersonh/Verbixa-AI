# syntax=docker/dockerfile:1
# Un solo servicio: corre el servidor web de Next.js y los workers de BullMQ
# (transcripción + resumen) juntos en el mismo contenedor (ver
# docker-entrypoint.sh). Comparten el mismo disco, así que los archivos
# subidos en app/api/meetings/upload/route.ts quedan disponibles para el
# worker sin necesitar un volumen compartido entre servicios.

FROM node:20-slim AS base
# openssl es requerido en runtime por el motor de Prisma (binaryTarget
# debian-openssl-3.0.x, ver prisma/schema.prisma).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Valores placeholder solo para que `next build` no falle si algún módulo
# los lee en tiempo de import (no se usan en runtime; Railway inyecta los
# reales al arrancar el contenedor). Ver lib/prisma.ts, lib/redis.ts y
# lib/queues/*.ts: todos están diseñados para no conectar de verdad en build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV REDIS_URL="redis://localhost:6379"
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Los workers corren vía tsx directo desde su fuente TS (no se compilan como
# parte de `next build`), así que necesitan estos dos directorios tal cual.
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/lib ./lib
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/uploads \
  && chown -R app:nodejs /app/uploads \
  && chmod +x ./docker-entrypoint.sh

USER app
EXPOSE 3000

CMD ["/bin/bash", "docker-entrypoint.sh"]
