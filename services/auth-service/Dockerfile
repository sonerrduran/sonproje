# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml ./
COPY services/auth-service/package.json ./services/auth-service/

# Install dependencies
RUN pnpm install --filter auth-service --frozen-lockfile

# Copy source
COPY services/auth-service ./services/auth-service

# Build
WORKDIR /app/services/auth-service
RUN pnpm build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/services/auth-service/dist ./dist
COPY --from=builder /app/services/auth-service/package.json ./package.json

RUN pnpm install --prod --frozen-lockfile 2>/dev/null || npm install --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
