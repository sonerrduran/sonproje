# ⚙️ Backend Architecture

## Global SaaS Education Platform

**Version:** 1.0 | **Technology:** NestJS + PostgreSQL + Redis + Prisma ORM

---

## 1. Backend Folder Structure

```
src/
├── main.ts                       # App bootstrap
├── app.module.ts                 # Root module
│
├── modules/                      # Feature modules
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/           # Passport strategies (JWT, Google)
│   │   ├── guards/               # JwtAuthGuard, RolesGuard
│   │   └── dto/
│   ├── school/
│   ├── user/
│   ├── classroom/
│   ├── lesson/
│   ├── practice/
│   ├── game/
│   ├── ai/
│   ├── analytics/
│   ├── notification/
│   └── payment/
│
├── common/                       # Shared utilities
│   ├── decorators/
│   │   ├── roles.decorator.ts    # @Roles(Role.Teacher)
│   │   ├── tenant.decorator.ts   # @CurrentTenant()
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── transform.interceptor.ts
│   │   └── tenant.interceptor.ts   # Sets DB tenant context
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── middleware/
│       └── tenant.middleware.ts
│
├── database/                     # DB configuration
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── prisma.service.ts
│   └── seeds/
│
├── cache/                        # Redis cache module
│   ├── cache.module.ts
│   └── cache.service.ts
│
├── queue/                        # BullMQ job queues
│   ├── queue.module.ts
│   ├── processors/
│   │   ├── email.processor.ts
│   │   ├── ai-generation.processor.ts
│   │   └── analytics.processor.ts
│   └── jobs/
│
├── config/                       # Configuration
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── jwt.config.ts
│   └── app.config.ts
│
└── health/                       # Health checks
    └── health.controller.ts
```

---

## 2. Service Layers

```
Controller (HTTP)
    │  DTOs + Validation
    ▼
Service (Business Logic)
    │  Domain rules, orchestration
    ▼
Repository (Data Access)       Cache Layer
    │  Prisma queries           Redis Service
    ▼
Database (PostgreSQL)
```

### Example Module Structure

```typescript
// modules/lesson/lesson.service.ts
@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly queue: Queue,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findById(id: string, schoolId: string): Promise<Lesson> {
    const cacheKey = `lesson:${id}`;
    const cached = await this.cache.get<Lesson>(cacheKey);
    if (cached) return cached;

    const lesson = await this.prisma.lesson.findFirst({
      where: { id, schoolId },  // tenant-scoped
    });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);

    await this.cache.set(cacheKey, lesson, 300); // TTL 5 min
    return lesson;
  }

  async markComplete(lessonId: string, studentId: string, schoolId: string) {
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, schoolId, completed: true, completedAt: new Date() },
      update: { completed: true, completedAt: new Date() },
    });
    // Emit analytics event asynchronously
    await this.queue.add('analytics.lesson.complete', { studentId, lessonId, schoolId });
  }
}
```

---

## 3. API Design

### Conventions

| Convention | Standard |
|-----------|---------|
| **URL format** | RESTful: `/api/v1/resources` |
| **Versioning** | URI-based `/v1/`, `/v2/` |
| **Pagination** | Cursor-based: `cursor`, `limit` params |
| **Filtering** | Query params: `?subject=math&grade=5` |
| **Sorting** | `?sort=created_at&order=desc` |
| **Response format** | `{ data, meta, error }` envelope |
| **Error codes** | RFC 7807 Problem Details |

### Standard Response Envelope

```typescript
// Standard success response
{
  "data": { ... },
  "meta": {
    "page": 1, "limit": 20, "total": 450,
    "hasNextPage": true
  }
}

// Standard error response
{
  "error": {
    "type": "https://errors.platform.com/validation",
    "title": "Validation Error",
    "status": 400,
    "detail": "The 'title' field is required.",
    "timestamp": "2026-03-11T21:00:00Z",
    "traceId": "abc123"
  }
}
```

---

## 4. Authentication Strategy

### JWT Flow

```typescript
// JWT Payload structure
interface JwtPayload {
  sub: string;        // user_id (UUID)
  school_id: string;  // tenant context
  role: UserRole;     // RBAC role
  iat: number;
  exp: number;
}

// Access token: 15 minutes TTL
// Refresh token: 7 days TTL, stored in Redis + httpOnly cookie

// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(), context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// Usage in controllers
@Get('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Teacher, Role.SchoolAdmin)
async getClassrooms(@CurrentTenant() schoolId: string) {
  return this.classroomService.findAll(schoolId);
}
```

---

## 5. Multi-Tenant Database Design

### Strategy: Shared DB + Row-Level Security

```prisma
// prisma/schema.prisma

model Lesson {
  id          String   @id @default(uuid())
  schoolId    String                         // Tenant key on every table
  teacherId   String?
  title       String
  content     Json
  status      String   @default("draft")
  createdAt   DateTime @default(now())

  @@index([schoolId])                        // Always index tenant key
  @@index([schoolId, status])
}
```

### Tenant Interceptor

```typescript
// interceptors/tenant.interceptor.ts
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const schoolId = req.user?.school_id;

    if (schoolId) {
      // Set PostgreSQL session variable for RLS
      await this.prisma.$executeRaw`
        SET LOCAL app.current_school_id = ${schoolId}
      `;
    }
    return next.handle();
  }
}
```

### Prisma Middleware for Auto-Filtering

```typescript
// Always inject schoolId in queries
prisma.$use(async (params, next) => {
  const tenantModels = ['Lesson', 'Classroom', 'User', 'Game', 'Assignment'];
  if (tenantModels.includes(params.model) && params.action === 'findMany') {
    params.args.where = { ...params.args.where, schoolId: currentSchoolId };
  }
  return next(params);
});
```

---

## 6. Caching Strategy

| Cache Type | Key Pattern | TTL | Invalidation |
|-----------|------------|-----|-------------|
| School settings | `school:{id}:settings` | 5 min | On PATCH /schools/:id |
| Lesson content | `lesson:{id}` | 5 min | On lesson update |
| Game metadata | `game:{id}` | 1 hour | On game update |
| User profile | `user:{id}` | 10 min | On profile update |
| Leaderboard | `leaderboard:{game}:{school}` | 60 sec | On score update |
| AI results | `ai:cache:{promptHash}` | 24 hours | Manual |
| Session data | `session:{token}` | 7 days | On logout |

```typescript
// cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length) await this.redis.del(...keys);
  }
}
```

---

## 7. Error Handling

```typescript
// filters/http-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus() : 500;
    const message = exception instanceof HttpException
      ? exception.message : 'Internal server error';

    // Log to centralized logger
    this.logger.error({ status, message, path: request.url, exception });

    response.status(status).json({
      error: {
        status,
        title: message,
        timestamp: new Date().toISOString(),
        traceId: request.headers['x-trace-id'],
      }
    });
  }
}
```

---

## 8. Logging System

```typescript
// Structured JSON logging with Winston
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),           // Dev: stdout
    new winston.transports.Http({              // Prod: Logstash/ELK
      host: process.env.LOGSTASH_HOST,
      port: 5044,
    }),
  ],
});

// Log enrichment middleware — attach traceId, schoolId, userId
app.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || randomUUID();
  res.setHeader('x-trace-id', req.traceId);
  logger.info('Request', {
    traceId: req.traceId, method: req.method,
    path: req.path, schoolId: req.user?.school_id,
  });
  next();
});
```

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
