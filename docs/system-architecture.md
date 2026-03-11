# 🏗️ System Architecture

## Global SaaS Education Platform

**Version:** 1.0 | **Date:** March 2026 | **Status:** Draft

---

## 1. High-Level Architecture Diagram

```
╔════════════════════════════════════════════════════════════════════╗
║                        CLIENT LAYER                                ║
║  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────┐  ┌────────┐  ║
║  │  Web    │  │  Windows │  │   Linux   │  │  iOS │  │Android │  ║
║  │Next.js  │  │ Desktop  │  │  Desktop  │  │  App │  │  App   │  ║
║  │(Browser)│  │(Electron)│  │ (Electron)│  │(RN)  │  │ (RN)   │  ║
║  └────┬────┘  └────┬─────┘  └─────┬─────┘  └──┬───┘  └───┬────┘  ║
╚═══════╪════════════╪══════════════╪════════════╪═══════════╪═══════╝
        │            │              │            │           │
        └────────────┴──────────────┴────────────┴───────────┘
                                   │ HTTPS / WSS
╔══════════════════════════════════╪═════════════════════════════════╗
║                    EDGE / CDN LAYER                                ║
║              ┌────────────────────────────────┐                    ║
║              │   Cloudflare CDN + WAF          │                    ║
║              │   - Static Assets               │                    ║
║              │   - Game Assets                 │                    ║
║              │   - DDoS Protection             │                    ║
║              └────────────────┬───────────────┘                    ║
╚═══════════════════════════════╪════════════════════════════════════╝
                                │
╔═══════════════════════════════╪════════════════════════════════════╗
║                    API GATEWAY LAYER                               ║
║              ┌────────────────────────────────┐                    ║
║              │   API Gateway (Kong / Nginx)    │                    ║
║              │   - Rate Limiting               │                    ║
║              │   - SSL Termination             │                    ║
║              │   - Request Routing             │                    ║
║              │   - Auth Middleware             │                    ║
║              └────────────────┬───────────────┘                    ║
╚═══════════════════════════════╪════════════════════════════════════╝
                                │
╔═══════════════════════════════╪════════════════════════════════════╗
║                  APPLICATION / SERVICES LAYER                      ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ║
║  │  Auth    │ │  School  │ │  User    │ │ Lesson   │ │  Game   │ ║
║  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service │ ║
║  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ ║
║       │            │            │             │            │      ║
║  ┌────┴─────┐ ┌────┴─────┐ ┌───┴──────┐ ┌────┴─────┐            ║
║  │   AI     │ │Analytics │ │Notif.    │ │ Payment  │            ║
║  │ Service  │ │ Service  │ │ Service  │ │ Service  │            ║
║  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘            ║
╚═══════╪════════════╪════════════╪═══════════════════════════════════╝
        │            │            │
╔═══════╪════════════╪════════════╪═══════════════════════════════════╗
║                     MESSAGING / EVENTS LAYER                       ║
║       └────────────┴────────────┘                                  ║
║              ┌───────────────────────────┐                         ║
║              │   Redis + BullMQ Queues   │                         ║
║              │   (Async Jobs & Events)   │                         ║
║              └───────────────────────────┘                         ║
╚════════════════════════════════════════════════════════════════════╝
                                │
╔═══════════════════════════════╪════════════════════════════════════╗
║                       DATA LAYER                                   ║
║  ┌──────────────┐ ┌─────────┐ ┌──────────────┐ ┌───────────────┐  ║
║  │  PostgreSQL  │ │  Redis  │ │  Object      │ │  Elasticsearch│  ║
║  │  (Primary DB)│ │  Cache  │ │  Storage     │ │  (Search)     │  ║
║  │  + Replicas  │ │         │ │  (S3-compat) │ │               │  ║
║  └──────────────┘ └─────────┘ └──────────────┘ └───────────────┘  ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 2. Main System Components

### 2.1 Client Applications

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Web App** | Next.js 14+ / TypeScript / Tailwind CSS | Primary web interface (students, teachers, admins) |
| **Desktop App (Win/Linux)** | Electron + Next.js | Offline-capable desktop experience |
| **Mobile App (iOS/Android)** | React Native / Expo | Native mobile learning experience |
| **Admin Dashboard** | Next.js (separate route/portal) | Super Admin and School Admin management |

### 2.2 Edge & CDN Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **CDN** | Cloudflare or AWS CloudFront | Static assets, game assets, media files |
| **WAF** | Cloudflare WAF | DDoS protection, bot blocking |
| **DNS** | Cloudflare DNS | Fast global DNS resolution |

### 2.3 API Gateway

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Gateway** | Kong / AWS API Gateway | Routing, rate limiting, auth middleware |
| **Load Balancer** | Nginx / AWS ALB | Distribute traffic across service pods |
| **SSL Termination** | Certbot / Cloudflare | Manage TLS certificates |

### 2.4 Application Services (NestJS Microservices)

| Service | Port | Responsibility |
|---------|------|---------------|
| **Auth Service** | 3001 | JWT, OAuth, sessions, MFA |
| **School Service** | 3002 | Tenant management, branding, settings |
| **User Service** | 3003 | User CRUD, roles, parent-student linking |
| **Classroom Service** | 3004 | Classrooms, student enrollment, teacher assignment |
| **Lesson Service** | 3005 | Lesson CRUD, assignment, progress tracking |
| **Practice Service** | 3006 | Practice sets, question banks, scoring |
| **Game Service** | 3007 | Game library, levels, progress, leaderboards |
| **AI Service** | 3008 | Gemini API integration, content generation |
| **Analytics Service** | 3009 | Event aggregation, dashboards, reports |
| **Notification Service** | 3010 | Email, push, in-app notifications |
| **Payment Service** | 3011 | Subscriptions, billing, invoices |
| **Media Service** | 3012 | File upload, storage, transcoding |

### 2.5 Data Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Primary Database** | PostgreSQL 16 | All structured application data |
| **Read Replicas** | PostgreSQL Streaming Replication | Scale read queries |
| **Cache** | Redis 7 | Sessions, hot data, queues, pub/sub |
| **Object Storage** | AWS S3 / MinIO | Game assets, images, media files |
| **Search Engine** | Elasticsearch | Full-text search across content and games |

---

## 3. Data Flow Between Components

### 3.1 Student Learning Flow

```
Student (Browser/App)
    │
    ▼
Cloudflare CDN ──── Static assets (JS, CSS, game files)
    │
    ▼
API Gateway (JWT verification)
    │
    ├──► Lesson Service ──► PostgreSQL (lesson content)
    │                   ──► Redis (cache lesson)
    │
    ├──► Game Service ──► PostgreSQL (game state)
    │                 ──► Object Storage (game assets via CDN)
    │
    └──► Analytics Service ──► PostgreSQL (progress events)
                           ──► Redis Queue (async processing)
```

### 3.2 AI Content Generation Flow

```
Teacher (Browser)
    │
    ▼
API Gateway
    │
    ▼
AI Service
    ├──► Check Redis Cache (duplicate prompt?)
    │         YES ──► Return cached content
    │         NO  ──►
    │               ▼
    │           Gemini API
    │               │
    │               ▼
    │           Content Validation + Safety Filter
    │               │
    │               ▼
    │           Store in PostgreSQL (pending review)
    │               │
    │               ▼
    │           Notification Service ──► Teacher notified
    │               │
    └───────────────┘
Teacher reviews → Publishes content
```

### 3.3 Assignment Flow

```
Teacher creates assignment
    │
    ▼
Assignment Service (via Lesson/Game Service)
    │
    ├──► PostgreSQL (assignment record)
    │
    ├──► BullMQ Queue (notification job)
    │         │
    │         ▼
    │    Notification Service
    │         ├──► Push notification (mobile)
    │         ├──► Email notification
    │         └──► In-app notification
    │
    └──► Student Dashboard refreshes (polling / WebSocket)
```

---

## 4. Infrastructure Overview

### 4.1 Kubernetes Cluster Layout

```
Kubernetes Cluster (AWS EKS / GCP GKE)
├── Namespace: platform-prod
│   ├── Deployment: auth-service (3 replicas)
│   ├── Deployment: school-service (2 replicas)
│   ├── Deployment: user-service (3 replicas)
│   ├── Deployment: lesson-service (3 replicas)
│   ├── Deployment: game-service (5 replicas)  ← heavy load
│   ├── Deployment: ai-service (3 replicas)
│   ├── Deployment: analytics-service (2 replicas)
│   ├── Deployment: notification-service (2 replicas)
│   └── Deployment: media-service (2 replicas)
│
├── Namespace: platform-data
│   ├── StatefulSet: postgresql-primary
│   ├── StatefulSet: postgresql-replica-1
│   ├── StatefulSet: postgresql-replica-2
│   └── StatefulSet: redis-cluster
│
└── Namespace: platform-infra
    ├── Deployment: api-gateway (kong)
    ├── Deployment: nginx-ingress
    └── Deployment: cert-manager
```

### 4.2 Docker Container Strategy

```yaml
# Each service is containerized
Services:
  - Base image: node:20-alpine
  - Multi-stage builds for minimal size
  - Non-root user execution
  - Health check endpoints (/health)
  - Resource limits per container (CPU/Memory)

Database:
  - PostgreSQL: postgres:16-alpine
  - Redis: redis:7-alpine

DevOps:
  - GitHub Actions CI/CD pipeline
  - Automated testing on PR
  - Docker image scanning (Trivy)
  - Push to ECR/GCR registry
  - Rolling deployments (zero downtime)
```

---

## 5. Scalability Strategy

### 5.1 Horizontal Scaling

| Service | Scaling Trigger | Min Pods | Max Pods |
|---------|----------------|----------|----------|
| Game Service | CPU > 70% | 3 | 20 |
| Auth Service | RPS > 500 | 2 | 10 |
| Lesson Service | CPU > 60% | 2 | 10 |
| AI Service | Queue depth > 50 | 2 | 8 |
| Analytics | CPU > 70% | 2 | 8 |

### 5.2 Caching Architecture

```
Request ──► Redis L1 Cache (hot data, TTL 60s)
               │ MISS
               ▼
           PostgreSQL Read Replica
               │
               ▼
           Store in Redis Cache
               │
               ▼
           Return response
```

### 5.3 Database Scaling

| Technique | Implementation |
|-----------|---------------|
| Connection Pooling | PgBouncer (max 1000 connections) |
| Read Distribution | 2 PostgreSQL read replicas |
| Query Optimization | Materialized views for analytics |
| Partitioning | Table partitioning by tenant/date |
| Indexing | Composite indexes on frequently queried columns |

### 5.4 CDN Strategy

```
Game Assets (up to 10,000 games):
  - All static game files served via CDN
  - Assets cached at edge nodes globally
  - Versioned URLs for cache busting
  - Lazy loading for game bundles

Media Files:
  - Lesson images/videos via CDN
  - Responsive image variants (WebP)
  - Video streaming (HLS for long videos)
```

---

## 6. Multi-Tenant Strategy

### 6.1 Tenant Isolation Approach: Shared Database + Row-Level Security (RLS)

```sql
-- Every table includes school_id for tenant isolation
CREATE TABLE lessons (
    id          UUID PRIMARY KEY,
    school_id   UUID NOT NULL REFERENCES schools(id),  -- Tenant key
    teacher_id  UUID NOT NULL,
    title       VARCHAR(255) NOT NULL,
    content     JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- PostgreSQL Row Level Security enforced at DB level
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON lessons
    USING (school_id = current_setting('app.current_school_id')::UUID);
```

### 6.2 Tenant Context Propagation

```
Request Headers: { Authorization: Bearer <JWT> }
    │
    ▼
JWT Payload: { user_id, school_id, role }
    │
    ▼
API Gateway extracts school_id
    │
    ▼
Service sets PostgreSQL session variable:
    SET app.current_school_id = '<school_id>'
    │
    ▼
All queries automatically filtered by RLS
```

### 6.3 Tenant Customization Storage

```json
// schools table: settings JSONB column
{
  "branding": {
    "logo_url": "https://cdn.../school-logo.png",
    "favicon_url": "https://cdn.../favicon.ico",
    "primary_color": "#1E40AF",
    "secondary_color": "#F59E0B",
    "font_family": "Inter"
  },
  "config": {
    "language": "tr",
    "timezone": "Europe/Istanbul",
    "academic_year_start": "09-01",
    "features": {
      "ai_content": true,
      "payments": false,
      "messaging": true
    }
  }
}
```

---

## 7. Security Architecture

```
External ──► Cloudflare WAF ──► DDoS / Bot filtering
              │
              ▼
API Gateway ──► Rate Limiting (per IP, per tenant)
              ──► JWT Validation
              ──► Request Logging
              │
              ▼
Service ──► RBAC Middleware (role check)
          ──► Input Validation (Zod/class-validator)
          ──► Data sanitization
          │
          ▼
Database ──► Row Level Security (tenant isolation)
           ──► Encrypted at rest (AES-256)
           ──► Encrypted in transit (TLS 1.3)
           ──► Audit log table
```

---

## 8. Monitoring & Observability

| Tool | Purpose |
|------|---------|
| **Prometheus** | Metrics collection |
| **Grafana** | Metrics dashboards |
| **ELK Stack** (Elasticsearch + Logstash + Kibana) | Centralized logging |
| **Jaeger / OpenTelemetry** | Distributed tracing |
| **Sentry** | Error tracking (frontend + backend) |
| **Uptime Robot** | External uptime monitoring |
| **PagerDuty** | On-call alerting |

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
