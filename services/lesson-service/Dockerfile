# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY services/lesson-service/package.json ./services/lesson-service/

RUN pnpm install --filter lesson-service --frozen-lockfile

COPY services/lesson-service ./services/lesson-service

WORKDIR /app/services/lesson-service
RUN pnpm build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3005

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/services/lesson-service/dist ./dist
COPY --from=builder /app/services/lesson-service/package.json ./package.json

RUN pnpm install --prod --frozen-lockfile 2>/dev/null || npm install --omit=dev

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
