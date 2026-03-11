# 🌌 Education Platform — Monorepo

**Global SaaS Education Platform** | Turborepo Monorepo

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web Apps** | Next.js 14, TypeScript, Tailwind CSS |
| **Mobile** | React Native (Expo) |
| **Desktop** | Tauri v2 + Next.js |
| **Backend** | NestJS, PostgreSQL, Redis, Prisma |
| **AI** | Google Gemini API |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Infrastructure** | Docker, Kubernetes |

## Repository Structure

```
education-platform/
├── apps/
│   ├── web/          # Student portal (Next.js, :3000)
│   ├── admin/        # Admin panel (Next.js, :3100)
│   ├── mobile/       # iOS/Android (Expo/React Native)
│   └── desktop/      # Windows/Linux/macOS (Tauri)
│
├── services/
│   ├── auth-service/       # :3001 — JWT, OAuth, MFA
│   ├── school-service/     # :3002 — Multi-tenant schools
│   ├── user-service/       # :3003 — Users, roles
│   ├── lesson-service/     # :3005 — Lessons, assignments
│   ├── game-service/       # :3007 — 10k games + levels
│   ├── ai-service/         # :3008 — Gemini API
│   └── analytics-service/  # :3009 — Dashboards, reports
│
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared React components
│   ├── api-client/   # Typed Axios API client
│   └── game-engine/  # Game PostMessage bridge + logic
│
├── infrastructure/
│   ├── docker/       # Docker Compose (dev + prod)
│   └── kubernetes/   # K8s manifests
│
├── docs/             # Architecture documentation
├── turbo.json        # Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start infrastructure (DB, Redis, MinIO)
```bash
cd infrastructure/docker
docker compose up postgres redis minio -d
```

### 3. Run database migrations (each service)
```bash
pnpm db:migrate
```

### 4. Start all apps and services
```bash
pnpm dev          # Starts everything in parallel
```

### Start individual apps
```bash
pnpm --filter @platform/web dev        # Student web app
pnpm --filter @platform/admin dev      # Admin panel
pnpm --filter @platform/auth-service dev  # Auth service only
```

## Key Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all services and apps |
| `pnpm build` | Build everything (Turbo cached) |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Run all tests |
| `pnpm format` | Format all files with Prettier |

## Documentation

All architecture docs are in the `docs/` folder:

- [`docs/product.md`](docs/product.md) — Product overview
- [`docs/requirements.md`](docs/requirements.md) — PRD
- [`docs/user-roles.md`](docs/user-roles.md) — Roles & permissions
- [`docs/system-architecture.md`](docs/system-architecture.md) — System design
- [`docs/microservices-architecture.md`](docs/microservices-architecture.md) — Service design
- [`docs/frontend-architecture.md`](docs/frontend-architecture.md) — Frontend design
- [`docs/backend-architecture.md`](docs/backend-architecture.md) — Backend design
- [`docs/game-engine-architecture.md`](docs/game-engine-architecture.md) — Game engine
- [`docs/ai-content-system.md`](docs/ai-content-system.md) — AI system

---

*Phase: 3 — Monorepo Foundation | March 2026*
