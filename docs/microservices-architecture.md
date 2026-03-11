# 🔧 Microservices Architecture

## Global SaaS Education Platform

**Version:** 1.0 | **Date:** March 2026

---

## Communication Patterns

| Pattern | Technology | Usage |
|---------|-----------|-------|
| **REST/HTTP** | Axios (internal) | Synchronous service-to-service calls |
| **Message Queue** | Redis + BullMQ | Async jobs (email, AI generation, analytics) |
| **Events** | Redis Pub/Sub | Real-time events (progress updates, notifications) |
| **WebSocket** | Socket.io | Live dashboards, leaderboards, notifications |

---

## 1. 🔐 Auth Service (Port: 3001)

### Responsibilities
- Email/password + SSO (Google, Microsoft) authentication
- JWT access token + refresh token rotation
- MFA (TOTP), session management, account lockout
- Password reset flows

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/forgot-password` | Password reset request |
| POST | `/auth/mfa/verify` | Verify MFA code |
| GET | `/auth/sessions` | List active sessions |
| GET | `/auth/google` | Google OAuth redirect |

### Database Tables

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY, user_id UUID NOT NULL, school_id UUID NOT NULL,
    token_hash VARCHAR(255), device_info JSONB, expires_at TIMESTAMP
);
CREATE TABLE password_resets (
    id UUID PRIMARY KEY, user_id UUID NOT NULL, token_hash VARCHAR(255),
    used BOOLEAN DEFAULT FALSE, expires_at TIMESTAMP
);
CREATE TABLE mfa_configs (
    id UUID PRIMARY KEY, user_id UUID UNIQUE NOT NULL,
    secret VARCHAR(255) NOT NULL, enabled BOOLEAN DEFAULT FALSE
);
```

### Dependencies
- **User Service** — fetch user + role on login
- **Redis** — refresh token storage, rate limit counters
- **BullMQ** — email queue (password reset, verification)

---

## 2. 🏫 School Service (Port: 3002)

### Responsibilities
- School tenant CRUD (Super Admin only)
- Branding config (logo, colors, favicon)
- Academic year, grade structure management
- Feature flag and quota management per school

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/schools` | List all schools |
| POST | `/schools` | Create new school |
| PATCH | `/schools/:id` | Update school settings |
| PATCH | `/schools/:id/branding` | Update branding |
| POST | `/schools/:id/suspend` | Suspend school |
| GET | `/schools/:id/config` | Get school config |

### Database Tables

```sql
CREATE TABLE schools (
    id UUID PRIMARY KEY, name VARCHAR(255), slug VARCHAR(100) UNIQUE,
    settings JSONB DEFAULT '{}', -- branding + config + features
    status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE grade_levels (
    id UUID PRIMARY KEY, school_id UUID REFERENCES schools(id),
    name VARCHAR(100), order_num INTEGER
);
```

### Dependencies
- **Redis** — cache school settings (TTL: 5 min)
- **Payment Service** — subscription data

---

## 3. 👤 User Service (Port: 3003)

### Responsibilities
- User CRUD within school tenants
- Role assignment, profile management (avatar, bio)
- Parent-student linking, bulk import/export

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/users` | List users (by school) |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update profile |
| DELETE | `/users/:id` | Deactivate (soft delete) |
| POST | `/users/bulk-import` | CSV/Excel import |
| POST | `/users/link-parent` | Link parent to student |

### Database Tables

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, email VARCHAR(255),
    password_hash VARCHAR(255), role VARCHAR(50) NOT NULL,
    first_name VARCHAR(100), last_name VARCHAR(100),
    avatar_url VARCHAR(500), status VARCHAR(20) DEFAULT 'active',
    UNIQUE(email, school_id)
);
CREATE TABLE parent_student_links (
    parent_id UUID REFERENCES users(id), student_id UUID REFERENCES users(id),
    PRIMARY KEY (parent_id, student_id)
);
```

### Dependencies
- **School Service** — tenant validation
- **Redis** — user profile cache

---

## 4. 🎓 Classroom Service (Port: 3004)

### Responsibilities
- Classroom CRUD, student enrollment
- Teacher assignment, class announcements

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/classrooms` | Create classroom |
| POST | `/classrooms/:id/enroll` | Enroll students |
| POST | `/classrooms/:id/teachers` | Assign teacher |
| GET | `/classrooms/:id/students` | List students |
| POST | `/classrooms/:id/announcements` | Post announcement |

### Database Tables

```sql
CREATE TABLE classrooms (
    id UUID PRIMARY KEY, school_id UUID NOT NULL,
    name VARCHAR(255), grade_level VARCHAR(100), is_archived BOOLEAN DEFAULT FALSE
);
CREATE TABLE classroom_students (
    classroom_id UUID, student_id UUID, PRIMARY KEY (classroom_id, student_id)
);
CREATE TABLE classroom_teachers (
    classroom_id UUID, teacher_id UUID, is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (classroom_id, teacher_id)
);
```

### Dependencies
- **User Service** — validate users
- **Notification Service** (event) — on announcement

---

## 5. 📚 Lesson Service (Port: 3005)

### Responsibilities
- Lesson CRUD (manual + AI-generated)
- Lesson assignment to students/classrooms
- Progress tracking, version management

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/lessons` | Browse lesson library |
| POST | `/lessons` | Create lesson |
| POST | `/lessons/generate` | Trigger AI generation |
| POST | `/lessons/:id/assign` | Assign to classroom |
| POST | `/lessons/:id/complete` | Student marks complete |
| GET | `/lessons/:id/progress` | Get completion stats |

### Database Tables

```sql
CREATE TABLE lessons (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, teacher_id UUID,
    title VARCHAR(255), subject VARCHAR(100), grade_level VARCHAR(50),
    content JSONB NOT NULL, source VARCHAR(20) DEFAULT 'manual',
    status VARCHAR(20) DEFAULT 'draft', language VARCHAR(10) DEFAULT 'en'
);
CREATE TABLE lesson_assignments (
    id UUID PRIMARY KEY, lesson_id UUID, teacher_id UUID, classroom_id UUID,
    due_date TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE lesson_progress (
    student_id UUID, lesson_id UUID, school_id UUID,
    progress_pct INTEGER DEFAULT 0, completed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (student_id, lesson_id)
);
```

### Dependencies
- **AI Service** (queue) — generate lesson content
- **Analytics Service** (event) — progress events
- **Notification Service** (event) — assignment notifications

---

## 6. ✏️ Practice Service (Port: 3006)

### Responsibilities
- Question bank management, practice set CRUD
- Student attempt tracking + scoring
- Adaptive difficulty + spaced repetition

### Database Tables

```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, lesson_id UUID,
    type VARCHAR(50) NOT NULL, content JSONB NOT NULL, answer JSONB NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium', source VARCHAR(20) DEFAULT 'manual'
);
CREATE TABLE practice_sets (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, teacher_id UUID,
    title VARCHAR(255), question_ids UUID[], config JSONB DEFAULT '{}'
);
CREATE TABLE practice_attempts (
    id UUID PRIMARY KEY, student_id UUID, set_id UUID,
    answers JSONB DEFAULT '[]', score INTEGER, started_at TIMESTAMP DEFAULT NOW()
);
```

### Dependencies
- **AI Service** (queue) — generate questions
- **Analytics Service** (event) — score events

---

## 7. 🎮 Game Service (Port: 3007)

### Responsibilities
- Game library CRUD (10,000+ games)
- Level management, game asset URL management
- Progress tracking, leaderboards, game assignment

### Main Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/games` | Browse game library |
| POST | `/games` | Upload new game |
| GET | `/games/:id/levels` | Get levels |
| POST | `/games/:id/levels` | Add level |
| POST | `/games/:id/assign` | Assign to students |
| POST | `/games/:id/progress` | Save game progress |
| GET | `/games/:id/leaderboard` | Get leaderboard |

### Database Tables

```sql
CREATE TABLE games (
    id UUID PRIMARY KEY, title VARCHAR(255), description TEXT,
    subject VARCHAR(100), grade_levels VARCHAR(100)[], thumbnail_url VARCHAR(500),
    tags VARCHAR(100)[], status VARCHAR(20) DEFAULT 'published'
);
CREATE TABLE game_levels (
    id UUID PRIMARY KEY, game_id UUID REFERENCES games(id),
    level_num INTEGER NOT NULL, asset_url VARCHAR(500) NOT NULL,
    config JSONB DEFAULT '{}', difficulty INTEGER DEFAULT 1,
    UNIQUE(game_id, level_num)
);
CREATE TABLE game_progress (
    student_id UUID, game_id UUID, school_id UUID,
    current_level INTEGER DEFAULT 1,
    levels_data JSONB DEFAULT '{}', total_score INTEGER DEFAULT 0,
    PRIMARY KEY (student_id, game_id)
);
```

### Dependencies
- **Redis** — leaderboard sorted sets
- **Analytics Service** (event) — game score events
- **Media Service** — game asset upload

---

## 8. 🤖 AI Service (Port: 3008)

### Responsibilities
- Gemini API integration for lesson + question generation
- Content safety filtering, usage quota enforcement
- Response caching, async job processing

### Database Tables

```sql
CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, teacher_id UUID,
    type VARCHAR(50) NOT NULL, prompt TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', result JSONB, tokens_used INTEGER
);
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, job_id UUID,
    tokens_in INTEGER, tokens_out INTEGER, cost_usd NUMERIC(10,6)
);
CREATE TABLE ai_cache (
    id UUID PRIMARY KEY, prompt_hash VARCHAR(64) UNIQUE NOT NULL,
    result JSONB NOT NULL, expires_at TIMESTAMP
);
```

### Dependencies
- **Gemini API** (external) — content generation
- **BullMQ** — async job queue
- **Redis** — prompt result cache (TTL: 24h)

---

## 9. 📊 Analytics Service (Port: 3009)

### Responsibilities
- Collect and aggregate learning events
- Dashboard data, report generation (PDF/CSV)
- Real-time activity + engagement metrics

### Database Tables

```sql
CREATE TABLE learning_events (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, entity_type VARCHAR(50),
    entity_id UUID, data JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, date DATE NOT NULL,
    stats JSONB NOT NULL, UNIQUE(school_id, date)
);
```

### Dependencies
- **BullMQ** — consume events from all services
- **Elasticsearch** — log aggregation

---

## 10. 🔔 Notification Service (Port: 3010)

### Responsibilities
- In-app, email, and push notifications
- Notification preferences, bulk announcements

### Database Tables

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY, school_id UUID NOT NULL, user_id UUID NOT NULL,
    type VARCHAR(100), title VARCHAR(255), body TEXT,
    data JSONB DEFAULT '{}', read BOOLEAN DEFAULT FALSE
);
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY, email BOOLEAN DEFAULT TRUE,
    push BOOLEAN DEFAULT TRUE, in_app BOOLEAN DEFAULT TRUE
);
```

### Dependencies
- **BullMQ** — async dispatch queue
- **Redis Pub/Sub** — real-time in-app delivery
- **SendGrid/SES** (external) — email
- **Firebase FCM** (external) — push

---

## 11. 💳 Payment Service (Port: 3011)

### Responsibilities
- Subscription plan management, Stripe integration
- Invoice generation, quota enforcement, dunning

### Database Tables

```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY, name VARCHAR(100), price_usd NUMERIC(10,2),
    billing VARCHAR(20), limits JSONB NOT NULL
);
CREATE TABLE school_subscriptions (
    id UUID PRIMARY KEY, school_id UUID UNIQUE, plan_id UUID,
    stripe_sub_id VARCHAR(255), status VARCHAR(20) DEFAULT 'active', renews_at TIMESTAMP
);
CREATE TABLE invoices (
    id UUID PRIMARY KEY, school_id UUID, amount_usd NUMERIC(10,2),
    status VARCHAR(20), pdf_url VARCHAR(500), created_at TIMESTAMP DEFAULT NOW()
);
```

### Dependencies
- **Stripe** (external) — payment processing
- **School Service** — update quotas on plan change
- **Notification Service** (event) — payment/invoice alerts

---

## Event Catalog

| Event | Producer | Consumers |
|-------|---------|----------|
| `user.registered` | User Service | Notification, Analytics |
| `lesson.completed` | Lesson Service | Analytics, Gamification |
| `game.level.completed` | Game Service | Analytics, Gamification |
| `practice.submitted` | Practice Service | Analytics |
| `assignment.created` | Lesson/Game Service | Notification |
| `ai.job.completed` | AI Service | Lesson/Practice Service |
| `school.subscribed` | Payment Service | School Service |
| `notification.send` | All Services | Notification Service |

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
