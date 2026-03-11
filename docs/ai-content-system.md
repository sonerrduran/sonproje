# 🤖 AI Content Generation System

## Global SaaS Education Platform — Gemini API Integration

**Version:** 1.0 | **Date:** March 2026

---

## 1. System Overview

```
Teacher Request
    │
    ▼
┌───────────────────────────────────────────────────────┐
│                   AI Content Pipeline                  │
│                                                        │
│  1. Request Validation  →  2. Cache Check             │
│         │ MISS                                         │
│         ▼                                             │
│  3. Prompt Building     →  4. Gemini API Call         │
│                                  │                    │
│  5. Safety Filter       ←────────┘                    │
│         │ PASS                                         │
│         ▼                                             │
│  6. Quality Scoring     →  7. Store + Cache           │
│                                  │                    │
│  8. Teacher Review      ←────────┘                    │
│         │ APPROVED                                     │
│         ▼                                             │
│  9. Publish Content                                   │
└───────────────────────────────────────────────────────┘
```

---

## 2. Content Types Supported

| Type | Gemini Task | Output Format | Avg Tokens |
|------|------------|---------------|-----------|
| **Lesson** | Generate structured lesson | JSON (content blocks) | ~1,500 |
| **Practice Questions** | Generate Q&A set | JSON (question array) | ~800 |
| **Answer Explanation** | Explain why answer is correct/wrong | JSON (explanation) | ~400 |
| **Lesson Summary** | Summarize lesson for review | JSON (summary text) | ~300 |
| **Study Notes** | Bullet-point study guide | JSON (notes) | ~500 |

---

## 3. AI Content Pipeline

### Step-by-Step

#### Step 1: Request Validation

```typescript
// ai/ai.service.ts
async generateLesson(dto: GenerateLessonDto, schoolId: string, teacherId: string) {
  // Validate school quota
  const usage = await this.getMonthlyUsage(schoolId);
  const quota = await this.schoolService.getAiQuota(schoolId);
  if (usage.tokensUsed >= quota.maxTokensPerMonth) {
    throw new QuotaExceededException('Monthly AI token quota reached');
  }

  // Validate language is supported
  if (!SUPPORTED_LANGUAGES.includes(dto.language)) {
    throw new BadRequestException(`Language ${dto.language} not supported`);
  }
  ...
}
```

#### Step 2: Cache Check

```typescript
const promptHash = createHash('sha256')
  .update(JSON.stringify({ type: 'lesson', ...dto }))
  .digest('hex');

const cached = await this.cache.get<GeneratedLesson>(`ai:cache:${promptHash}`);
if (cached) {
  this.logger.log('AI cache HIT', { promptHash });
  return cached;
}
```

#### Step 3: Build Prompt

```typescript
const prompt = this.promptBuilder.build('lesson', {
  topic: dto.topic,
  subject: dto.subject,
  gradeLevel: dto.gradeLevel,
  language: dto.language,
  learningObjectives: dto.objectives,
  lengthHint: 'medium',   // short | medium | long
  style: 'engaging',
});
```

#### Step 4: Gemini API Call

```typescript
const model = this.genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.7,
    maxOutputTokens: 2048,
  },
  safetySettings: SAFETY_SETTINGS,
});

const result = await model.generateContent(prompt);
const raw = JSON.parse(result.response.text());
```

#### Step 5: Safety Filter

```typescript
const safetyCheck = await this.safetyFilter.check(raw);
if (!safetyCheck.passed) {
  await this.logFailedGeneration(schoolId, dto, safetyCheck.reason);
  throw new ContentSafetyException('Generated content failed safety check');
}
```

#### Step 6: Quality Scoring + Store

```typescript
const qualityScore = this.qualityScorer.score(raw, dto);
await this.prisma.aiJob.update({
  where: { id: job.id },
  data: { status: 'done', result: raw, qualityScore, tokensUsed },
});

// Cache for 24 hours to avoid duplicate calls
await this.cache.set(`ai:cache:${promptHash}`, raw, 86400);

// Notify teacher for review
await this.notificationService.send(teacherId, 'ai.content.ready', { jobId: job.id });
```

---

## 4. Prompt Generation System

### Prompt Templates

```typescript
// ai/prompts/lesson.prompt.ts
export const LESSON_PROMPT_TEMPLATE = `
You are an expert educational content creator.

Generate a lesson for the following parameters:
- Subject: {{subject}}
- Topic: {{topic}}
- Grade Level: {{gradeLevel}}
- Language: {{language}}
- Learning Objectives: {{objectives}}

Output a JSON object with this exact structure:
{
  "title": "string",
  "introduction": "string",
  "sections": [
    {
      "heading": "string",
      "body": "string",
      "type": "text|example|definition|note"
    }
  ],
  "summary": "string",
  "keyTerms": [{ "term": "string", "definition": "string" }],
  "estimatedMinutes": number
}

Rules:
- Use age-appropriate language for grade {{gradeLevel}}
- All content must be in {{language}}
- Include real-world examples
- Keep each section concise and engaging
- Do NOT include any inappropriate content
`;
```

### Prompt Builder

```typescript
// ai/prompt-builder.service.ts
@Injectable()
export class PromptBuilderService {
  private templates = new Map<string, string>([
    ['lesson', LESSON_PROMPT_TEMPLATE],
    ['questions', QUESTIONS_PROMPT_TEMPLATE],
    ['explanation', EXPLANATION_PROMPT_TEMPLATE],
    ['summary', SUMMARY_PROMPT_TEMPLATE],
  ]);

  build(type: string, variables: Record<string, string>): string {
    const template = this.templates.get(type);
    if (!template) throw new Error(`Unknown prompt type: ${type}`);

    return Object.entries(variables).reduce(
      (prompt, [key, value]) => prompt.replace(new RegExp(`{{${key}}}`, 'g'), value),
      template
    );
  }
}
```

---

## 5. Content Validation

### JSON Schema Validation

```typescript
// Validate AI output matches expected schema before storing
import Ajv from 'ajv';
const ajv = new Ajv();

const LESSON_SCHEMA = {
  type: 'object',
  required: ['title', 'introduction', 'sections', 'summary'],
  properties: {
    title: { type: 'string', minLength: 5, maxLength: 200 },
    introduction: { type: 'string', minLength: 50 },
    sections: {
      type: 'array', minItems: 2,
      items: {
        type: 'object',
        required: ['heading', 'body'],
        properties: {
          heading: { type: 'string' },
          body: { type: 'string', minLength: 100 },
          type: { enum: ['text', 'example', 'definition', 'note'] },
        }
      }
    },
    summary: { type: 'string', minLength: 30 },
  }
};

const validate = ajv.compile(LESSON_SCHEMA);
if (!validate(parsedResult)) {
  throw new ContentValidationException('AI output does not match lesson schema');
}
```

### Quality Scorer

```typescript
interface QualityScore {
  total: number;        // 0-100
  breakdown: {
    completeness: number;   // All required fields present
    length: number;         // Appropriate content length
    structureScore: number; // Proper section structure
    languageMatch: number;  // Content in requested language
  };
  passed: boolean;      // total >= 60 to pass
}
```

---

## 6. Storage Structure

```
PostgreSQL:
  ai_jobs         — job metadata, status, token usage
  ai_usage_logs   — per-school cost tracking
  ai_cache        — prompt hash → result (overflow from Redis)

Redis:
  ai:cache:{promptHash}    TTL: 24h   Hot cache for popular prompts
  ai:quota:{schoolId}      TTL: 1h    Current month usage counter

Object Storage (S3):
  /ai-content/lessons/{job_id}.json     — raw generated lesson
  /ai-content/questions/{job_id}.json   — raw generated questions
```

---

## 7. Cost Control Strategy

### Per-School Quota Enforcement

```typescript
interface SchoolAiQuota {
  schoolId: string;
  plan: 'basic' | 'pro' | 'enterprise';
  maxTokensPerMonth: number;   // basic: 500k | pro: 2M | enterprise: 10M
  currentUsage: number;
  resetDate: Date;
}

// Before every Gemini call:
async enforceQuota(schoolId: string, estimatedTokens: number) {
  const quota = await this.getQuota(schoolId);
  if (quota.currentUsage + estimatedTokens > quota.maxTokensPerMonth) {
    throw new QuotaExceededException(
      `School has used ${quota.currentUsage}/${quota.maxTokensPerMonth} tokens this month`
    );
  }
}

// After every Gemini call: increment usage counter
async recordUsage(schoolId: string, tokensUsed: number, costUsd: number) {
  await this.redis.incrby(`ai:quota:${schoolId}:tokens`, tokensUsed);
  await this.prisma.aiUsageLog.create({
    data: { schoolId, tokensUsed, costUsd }
  });
}
```

### Gemini Model Selection by Task

| Task | Model | Cost Priority |
|------|-------|--------------|
| Lesson generation | `gemini-1.5-flash` | Low cost, high speed |
| Question generation | `gemini-1.5-flash` | Low cost |
| Explanation (real-time) | `gemini-1.5-flash` | Lowest latency |
| Complex curriculum alignment | `gemini-1.5-pro` | Quality priority |

---

## 8. Caching Strategy

```
Incoming request with prompt
    │
    ▼
Compute SHA256(prompt + params) = promptHash
    │
    ▼
Check Redis: ai:cache:{promptHash}
    │
    ├── HIT → return cached result (free, instant)
    │
    └── MISS → Call Gemini API
                │
                ▼
            Store in Redis (TTL: 24h)
            Store in PostgreSQL ai_cache (TTL: 7 days)
                │
                ▼
            Return result
```

### Cache Benefits

| Scenario | Savings |
|----------|---------|
| Two teachers request same topic/grade | 100% token save on 2nd+ request |
| Same question bank regenerated | Cache hit after first generation |
| Explanation for common wrong answers | Cached after first student error |

---

## 9. Quality Control System

### Teacher Review Flow

```
AI generates content (status: pending_review)
    │
    ▼
Notification sent to requesting teacher
    │
    ▼
Teacher opens review panel:
  ├── Preview generated content
  ├── Edit any section inline
  ├── Approve → status: published
  └── Reject → status: rejected + optional feedback
```

### Auto-Publish Threshold

```typescript
// Content above quality score 85 can be auto-published (opt-in per school)
if (qualityScore.total >= 85 && school.config.ai_auto_publish === true) {
  await lessonService.publish(jobId);
} else {
  // Route to teacher review queue
  await notifyTeacherForReview(teacherId, jobId);
}
```

### Feedback Loop for Improvement

```typescript
// Log teacher edits to improve prompt quality over time
interface ContentFeedback {
  jobId: string;
  teacherId: string;
  action: 'approved' | 'edited' | 'rejected';
  editsPercent?: number;    // % of content changed before approval
  rejectionReason?: string;
}
```

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
