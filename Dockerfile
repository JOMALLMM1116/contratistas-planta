# syntax=docker/dockerfile:1

# ---- Base comun: Node 24 sobre Debian (compatible con los binarios de argon2) ----
FROM node:24-bookworm-slim AS base
WORKDIR /app/server

# ---- 1. Dependencias completas (para compilar) ----
FROM base AS deps
COPY server/package.json server/package-lock.json ./
RUN npm ci

# ---- 2. Compilacion: cliente de Prisma + TypeScript a dist/ ----
FROM deps AS build
COPY server/ ./
# prisma generate no se conecta a la base, pero la configuracion exige que exista DATABASE_URL
RUN DATABASE_URL="postgres://build:build@localhost:5432/build" npx prisma generate \
 && npx tsc

# ---- 3. Solo dependencias de produccion ----
FROM base AS prod-deps
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---- 4. Imagen final ----
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads
WORKDIR /app/server

COPY --from=prod-deps /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY server/package.json ./

# Carpeta de documentos (en produccion se monta un volumen aqui)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# No se ejecuta como root
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
