import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface WeakTopic {
  subject: string;
  topic: string;
  avgScore: number;
  attempts: number;
  tags: string[];
}

interface Recommendation {
  type: 'lesson' | 'game' | 'practice';
  id: string;
  title: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
}

@Injectable()
export class LearningIntelligenceService {
  private readonly logger = new Logger(LearningIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Weak Topic Detection ─────────────────────────────────

  async getWeakTopics(studentId: string, schoolId: string): Promise<WeakTopic[]> {
    const cacheKey = `intel:weak:${studentId}`;
    const cached = await this.redis.get<WeakTopic[]>(cacheKey);
    if (cached) return cached;

    // Aggregate practice attempt scores by lesson tags
    const attempts = await this.prisma.practiceAttempt.findMany({
      where: { studentId, schoolId, completedAt: { not: null } },
      include: {
        set: {
          include: {
            items: {
              include: {
                question: { select: { tags: true, lessonId: true } },
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    // Group scores by tags
    const tagScores = new Map<string, { total: number; count: number; attempts: number }>();
    for (const attempt of attempts) {
      const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
      const allTags = attempt.set.items.flatMap((i) => i.question.tags);

      for (const tag of allTags) {
        if (!tag) continue;
        const current = tagScores.get(tag) ?? { total: 0, count: 0, attempts: 0 };
        tagScores.set(tag, { total: current.total + pct, count: current.count + 1, attempts: current.attempts + 1 });
      }
    }

    // Also check lesson progress — incomplete lessons = weak areas
    const incompleteProgress = await this.prisma.lessonProgress.findMany({
      where: { studentId, schoolId, completed: false, progressPct: { gt: 0, lt: 80 } },
      include: { lesson: { select: { tags: true, subject: true, title: true } } },
      take: 10,
    });

    const weakFromPractice: WeakTopic[] = Array.from(tagScores.entries())
      .filter(([, v]) => v.attempts >= 2 && (v.total / v.count) < 60)
      .sort((a, b) => (a[1].total / a[1].count) - (b[1].total / b[1].count))
      .slice(0, 5)
      .map(([tag, v]) => ({
        subject: tag,
        topic: tag,
        avgScore: Math.round(v.total / v.count),
        attempts: v.attempts,
        tags: [tag],
      }));

    const weakFromLessons: WeakTopic[] = incompleteProgress
      .slice(0, 3)
      .map((lp) => ({
        subject: lp.lesson.subject ?? 'General',
        topic: lp.lesson.title,
        avgScore: lp.progressPct,
        attempts: 1,
        tags: lp.lesson.tags,
      }));

    const result = [...weakFromPractice, ...weakFromLessons];
    await this.redis.set(cacheKey, result, 3600); // 1h cache
    return result;
  }

  // ─── Strong Topic Detection ────────────────────────────────

  async getStrongTopics(studentId: string, schoolId: string) {
    const cacheKey = `intel:strong:${studentId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const attempts = await this.prisma.practiceAttempt.findMany({
      where: { studentId, schoolId, completedAt: { not: null } },
      include: {
        set: { include: { items: { include: { question: { select: { tags: true } } } } } },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    const tagScores = new Map<string, { total: number; count: number }>();
    for (const attempt of attempts) {
      const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
      const allTags = attempt.set.items.flatMap((i) => i.question.tags ?? []);
      for (const tag of allTags) {
        const current = tagScores.get(tag) ?? { total: 0, count: 0 };
        tagScores.set(tag, { total: current.total + pct, count: current.count + 1 });
      }
    }

    const strong = Array.from(tagScores.entries())
      .filter(([, v]) => v.count >= 2 && (v.total / v.count) >= 80)
      .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
      .slice(0, 5)
      .map(([tag, v]) => ({
        topic: tag,
        avgScore: Math.round(v.total / v.count),
        attempts: v.count,
      }));

    await this.redis.set(cacheKey, strong, 3600);
    return strong;
  }

  // ─── Recommendations ──────────────────────────────────────

  async getRecommendations(studentId: string, schoolId: string): Promise<Recommendation[]> {
    const cacheKey = `intel:recs:${studentId}`;
    const cached = await this.redis.get<Recommendation[]>(cacheKey);
    if (cached) return cached;

    const recommendations: Recommendation[] = [];

    // 1. Incomplete lessons (high urgency if > 50% done)
    const inProgress = await this.prisma.lessonProgress.findMany({
      where: { studentId, schoolId, completed: false, progressPct: { gte: 30 } },
      include: { lesson: { select: { id: true, title: true } } },
      orderBy: { progressPct: 'desc' },
      take: 3,
    });

    for (const lp of inProgress) {
      recommendations.push({
        type: 'lesson',
        id: lp.lessonId,
        title: lp.lesson.title,
        reason: `You are ${lp.progressPct}% through this lesson — finish it!`,
        urgency: lp.progressPct >= 70 ? 'high' : 'medium',
      });
    }

    // 2. Assigned but not started lessons
    const assigned = await this.prisma.lessonAssignment.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        lesson: { status: 'PUBLISHED' },
        ...(await this.getAssignedToStudent(studentId, schoolId)),
      },
      include: { lesson: { select: { id: true, title: true } } },
      take: 3,
    });

    for (const a of assigned) {
      const alreadyIn = recommendations.find((r) => r.id === a.lessonId);
      if (!alreadyIn) {
        recommendations.push({
          type: 'lesson',
          id: a.lessonId,
          title: a.lesson.title,
          reason: 'Assigned by your teacher',
          urgency: a.dueDate && a.dueDate < new Date(Date.now() + 86_400_000 * 3) ? 'high' : 'medium',
        });
      }
    }

    // 3. Games not yet played
    const weakTopics = await this.getWeakTopics(studentId, schoolId);
    if (weakTopics.length > 0) {
      const weakTags = weakTopics.map((w) => w.topic).slice(0, 3);
      const practiceGames = await this.prisma.game.findMany({
        where: {
          schoolId,
          status: 'PUBLISHED',
          tags: { hasSome: weakTags },
          NOT: { progress: { some: { studentId } } },
        },
        take: 2,
      });

      for (const game of practiceGames) {
        recommendations.push({
          type: 'game',
          id: game.id,
          title: game.title,
          reason: `Practice game to strengthen weak topics: ${weakTags.join(', ')}`,
          urgency: 'high',
        });
      }
    }

    // 4. Practice sets not attempted
    const untriedPractice = await this.prisma.practiceSet.findMany({
      where: {
        schoolId,
        NOT: { attempts: { some: { studentId } } },
      },
      take: 2,
    });

    for (const ps of untriedPractice) {
      recommendations.push({
        type: 'practice',
        id: ps.id,
        title: ps.title,
        reason: 'New practice set available',
        urgency: 'low',
      });
    }

    // Sort: high urgency first
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    const sorted = recommendations
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
      .slice(0, 8);

    await this.redis.set(cacheKey, sorted, 1800); // 30-min cache
    return sorted;
  }

  // ─── Learning Streak ──────────────────────────────────────

  async getLearningStreak(studentId: string) {
    const events = await this.prisma.learningEvent.findMany({
      where: { userId: studentId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    if (events.length === 0) return { currentStreak: 0, longestStreak: 0, activeDates: [] };

    const days = new Set(events.map((e) => e.createdAt.toISOString().slice(0, 10)));
    const sortedDays = Array.from(days).sort().reverse();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    // Current streak (must include today or yesterday)
    if (sortedDays[0] === today || sortedDays[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
        if (diff === 1) currentStreak++;
        else break;
      }
    }

    // Longest streak
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
      if (diff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    return { currentStreak, longestStreak, activeDates: sortedDays.slice(0, 30) };
  }

  // ─── Helper ───────────────────────────────────────────────

  private async getAssignedToStudent(studentId: string, schoolId: string) {
    const classrooms = await this.prisma.classroomStudent.findMany({
      where: { studentId },
      select: { classroomId: true },
    });
    const classroomIds = classrooms.map((c) => c.classroomId);

    return {
      OR: [
        { studentId },
        { classroomId: { in: classroomIds } },
      ],
    };
  }
}
