import { Injectable, Logger, TooManyRequestsException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../database/prisma.service';
import type { ContentType, PromptContext } from './prompt-builder.service';

interface RateLimitConfig {
  perSchoolPerMinute: number;   // default 10
  perSchoolPerDay: number;      // default 200
  globalPerMinute: number;      // default 100
}

interface UsageSummary {
  schoolToday: number;
  schoolLastMinute: number;
  totalToday: number;
  cacheHitRate: number;
}

@Injectable()
export class AiCostControlService {
  private readonly logger = new Logger(AiCostControlService.name);
  private readonly CACHE_TTL = 86_400;   // 24h — same topic/grade yields same content
  private readonly limits: RateLimitConfig;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.limits = {
      perSchoolPerMinute: this.config.get<number>('ai.rateLimit.perSchoolPerMinute', 10),
      perSchoolPerDay: this.config.get<number>('ai.rateLimit.perSchoolPerDay', 200),
      globalPerMinute: this.config.get<number>('ai.rateLimit.globalPerMinute', 100),
    };
  }

  // ─── Rate limiting ─────────────────────────────────────────

  async checkRateLimit(schoolId: string): Promise<void> {
    const minuteKey = `ai:rl:school:${schoolId}:m`;
    const dayKey    = `ai:rl:school:${schoolId}:d:${this.today()}`;
    const globalKey = `ai:rl:global:m`;

    const [schoolMinute, schoolDay, global] = await Promise.all([
      this.redis.incr(minuteKey),
      this.redis.incr(dayKey),
      this.redis.incr(globalKey),
    ]);

    await Promise.all([
      this.redis.expire(minuteKey, 60),
      this.redis.expire(dayKey, 86_400),
      this.redis.expire(globalKey, 60),
    ]);

    if ((schoolMinute as number) > this.limits.perSchoolPerMinute) {
      throw new TooManyRequestsException(
        `AI rate limit: max ${this.limits.perSchoolPerMinute} requests/minute per school. Try again shortly.`,
      );
    }
    if ((schoolDay as number) > this.limits.perSchoolPerDay) {
      throw new TooManyRequestsException(
        `Daily AI limit reached (${this.limits.perSchoolPerDay} requests/day). Resets at midnight.`,
      );
    }
    if ((global as number) > this.limits.globalPerMinute) {
      throw new TooManyRequestsException(
        'Platform AI capacity reached. Try again in a moment.',
      );
    }
  }

  // ─── Content caching ──────────────────────────────────────

  async getCached<T>(type: ContentType, ctx: PromptContext): Promise<T | null> {
    const key = this.cacheKey(type, ctx);
    const cached = await this.redis.get<T>(key);
    if (cached) {
      this.logger.debug(`Cache HIT: ${type} [${ctx.subject}:${ctx.topic}:${ctx.gradeLevel}]`);
      await this.incrementCounter('cache_hit');
    }
    return cached;
  }

  async setCached<T>(type: ContentType, ctx: PromptContext, data: T): Promise<void> {
    const key = this.cacheKey(type, ctx);
    await this.redis.set(key, data, this.CACHE_TTL);
    await this.incrementCounter('cache_set');
    this.logger.debug(`Cached: ${type} [${ctx.subject}:${ctx.topic}]`);
  }

  // ─── Usage tracking ───────────────────────────────────────

  async trackUsage(schoolId: string, type: ContentType, tokensUsed?: number): Promise<void> {
    await this.prisma.aiJob.updateMany({
      where: {
        schoolId,
        status: 'DONE',
        type: type.toUpperCase().replace('-', '_'),
        completedAt: { gte: new Date(Date.now() - 5000) }, // Last 5 seconds
      },
      data: { ...(tokensUsed ? { tokensUsed } : {}) },
    }).catch(() => {});  // Best-effort
  }

  async getUsageSummary(schoolId: string): Promise<UsageSummary> {
    const dayKey   = `ai:rl:school:${schoolId}:d:${this.today()}`;
    const minKey   = `ai:rl:school:${schoolId}:m`;
    const hitCount = await this.redis.get<number>(`ai:counter:cache_hit`) ?? 0;
    const setCount = await this.redis.get<number>(`ai:counter:cache_set`) ?? 0;

    const [schoolToday, schoolLastMinute] = await Promise.all([
      this.redis.get<number>(dayKey) ?? 0,
      this.redis.get<number>(minKey) ?? 0,
    ]);

    const totalToday = await this.prisma.aiJob.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    return {
      schoolToday: (schoolToday as number) || 0,
      schoolLastMinute: (schoolLastMinute as number) || 0,
      totalToday,
      cacheHitRate: setCount > 0 ? Math.round(((hitCount as number) / (setCount as number)) * 100) : 0,
    };
  }

  // ─── Deduplication ────────────────────────────────────────

  async findSimilarContent(schoolId: string, type: ContentType, ctx: PromptContext): Promise<boolean> {
    // Check if a similar AiJob (same school, topic, grade) was completed recently
    const existing = await this.prisma.aiJob.findFirst({
      where: {
        schoolId,
        type: type.toUpperCase().replace('-', '_'),
        status: 'DONE',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        prompt: { contains: ctx.topic },
      },
    });
    return !!existing;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private cacheKey(type: ContentType, ctx: PromptContext): string {
    const raw = `${type}:${ctx.subject}:${ctx.topic}:${ctx.gradeLevel}:${ctx.difficulty ?? 'medium'}:${ctx.language ?? 'en'}:${ctx.questionCount ?? ''}`;
    const hash = crypto.createHash('sha256').update(raw.toLowerCase().trim()).digest('hex').slice(0, 24);
    return `ai:cache:${hash}`;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async incrementCounter(key: string) {
    await this.redis.incr(`ai:counter:${key}`);
  }
}
