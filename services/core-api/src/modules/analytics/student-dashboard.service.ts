import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GamificationService } from '../games/gamification.service';
import { LearningIntelligenceService } from './learning-intelligence.service';

@Injectable()
export class StudentDashboardService {
  private readonly logger = new Logger(StudentDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gamification: GamificationService,
    private readonly intelligence: LearningIntelligenceService,
  ) {}

  async getDashboard(studentId: string, schoolId: string) {
    const cacheKey = `dashboard:student:${studentId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const [
      xpSummary,
      lessonStats,
      gameStats,
      practiceStats,
      badges,
      weakTopics,
      recommendations,
      streak,
      recentActivity,
    ] = await Promise.all([
      this.gamification.getXpSummary(studentId),
      this.getLessonStats(studentId, schoolId),
      this.getGameStats(studentId),
      this.getPracticeStats(studentId, schoolId),
      this.gamification.getUserBadges(studentId),
      this.intelligence.getWeakTopics(studentId, schoolId),
      this.intelligence.getRecommendations(studentId, schoolId),
      this.intelligence.getLearningStreak(studentId),
      this.getRecentActivity(studentId),
    ]);

    const result = {
      xp: xpSummary,
      lessons: lessonStats,
      games: gameStats,
      practice: practiceStats,
      badges: {
        count: badges.length,
        recent: badges.slice(0, 3).map((b) => ({ title: b.badge.title, icon: b.badge.iconUrl })),
      },
      weakTopics: weakTopics.slice(0, 3),
      recommendations: recommendations.slice(0, 5),
      streak,
      recentActivity,
    };

    await this.redis.set(cacheKey, result, 120); // 2-min cache
    return result;
  }

  async getDetailedProgress(studentId: string, schoolId: string) {
    const [lessonProgress, gameProgress, attemptHistory] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId, schoolId },
        include: { lesson: { select: { id: true, title: true, subject: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.gameProgress.findMany({
        where: { studentId },
        include: { game: { select: { id: true, title: true, subject: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.practiceAttempt.findMany({
        where: { studentId, schoolId },
        include: { set: { select: { title: true } } },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    return { lessonProgress, gameProgress, attemptHistory };
  }

  async getWeeklyActivity(studentId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [lessonEvents, gameEvents, practiceEvents] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId, updatedAt: { gte: sevenDaysAgo } },
        select: { updatedAt: true, progressPct: true },
      }),
      this.prisma.gameProgress.findMany({
        where: { studentId, updatedAt: { gte: sevenDaysAgo } },
        select: { updatedAt: true },
      }),
      this.prisma.practiceAttempt.findMany({
        where: { studentId, startedAt: { gte: sevenDaysAgo } },
        select: { startedAt: true, score: true, maxScore: true },
      }),
    ]);

    // Build day-by-day activity map
    const dayMap = new Map<string, { lessons: number; games: number; practice: number; xpEstimate: number }>();
    const initDay = (d: string) => dayMap.set(d, dayMap.get(d) ?? { lessons: 0, games: 0, practice: 0, xpEstimate: 0 });

    for (const e of lessonEvents) {
      const day = e.updatedAt.toISOString().slice(0, 10);
      initDay(day);
      dayMap.get(day)!.lessons++;
      dayMap.get(day)!.xpEstimate += 10;
    }
    for (const e of gameEvents) {
      const day = e.updatedAt.toISOString().slice(0, 10);
      initDay(day);
      dayMap.get(day)!.games++;
      dayMap.get(day)!.xpEstimate += 20;
    }
    for (const e of practiceEvents) {
      const day = e.startedAt.toISOString().slice(0, 10);
      initDay(day);
      dayMap.get(day)!.practice++;
      if (e.maxScore > 0) dayMap.get(day)!.xpEstimate += (e.score / e.maxScore) * 50;
    }

    return Array.from(dayMap.entries()).map(([date, stats]) => ({ date, ...stats })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ─── Private helpers ──────────────────────────────────────

  private async getLessonStats(studentId: string, schoolId: string) {
    const [inProgress, completed, total] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: false, progressPct: { gt: 0 } } }),
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: true } }),
      this.prisma.lessonAssignment.count({ where: { schoolId } }),
    ]);

    return { inProgress, completed, assigned: total };
  }

  private async getGameStats(studentId: string) {
    const [gamesPlayed, levelsCompleted, bestScore] = await Promise.all([
      this.prisma.gameProgress.count({ where: { studentId } }),
      this.prisma.gameProgress.aggregate({ where: { studentId }, _sum: { levelsCompleted: true } }),
      this.prisma.gameProgress.aggregate({ where: { studentId }, _max: { totalScore: true } }),
    ]);

    return {
      gamesPlayed,
      levelsCompleted: levelsCompleted._sum.levelsCompleted ?? 0,
      bestScore: bestScore._max.totalScore ?? 0,
    };
  }

  private async getPracticeStats(studentId: string, schoolId: string) {
    const stats = await this.prisma.practiceAttempt.aggregate({
      where: { studentId, schoolId, completedAt: { not: null } },
      _count: true,
      _avg: { score: true },
    });

    const best = await this.prisma.practiceAttempt.findFirst({
      where: { studentId, schoolId, completedAt: { not: null } },
      orderBy: { score: 'desc' },
      select: { score: true, maxScore: true },
    });

    return {
      totalAttempts: stats._count,
      avgScore: Math.round(stats._avg.score ?? 0),
      bestScore: best ? { score: best.score, maxScore: best.maxScore } : null,
    };
  }

  private async getRecentActivity(studentId: string) {
    const events = await this.prisma.learningEvent.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { eventType: true, entityType: true, entityId: true, createdAt: true, metadata: true },
    });
    return events;
  }
}
