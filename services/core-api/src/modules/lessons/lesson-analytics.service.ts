import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LessonAnalyticsService {
  private readonly logger = new Logger(LessonAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getLessonStats(lessonId: string, schoolId: string) {
    const cacheKey = `analytics:lesson:${lessonId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const [total, completed, progress] = await Promise.all([
      this.prisma.lessonAssignment.count({ where: { lessonId, schoolId } }),
      this.prisma.lessonProgress.count({ where: { lessonId, schoolId, completed: true } }),
      this.prisma.lessonProgress.findMany({
        where: { lessonId, schoolId },
        select: { progressPct: true, completedAt: true },
      }),
    ]);

    const avgProgress = progress.length > 0
      ? Math.round(progress.reduce((s, p) => s + p.progressPct, 0) / progress.length)
      : 0;

    const result = {
      totalAssigned: total,
      totalCompleted: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgProgress,
    };

    await this.redis.set(cacheKey, result, 300);
    return result;
  }

  async getSchoolLessonDashboard(schoolId: string) {
    const cacheKey = `analytics:lessons:school:${schoolId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const [totalLessons, published, aiGenerated, completions, avgPractice] = await Promise.all([
      this.prisma.lesson.count({ where: { schoolId } }),
      this.prisma.lesson.count({ where: { schoolId, status: 'PUBLISHED' } }),
      this.prisma.lesson.count({ where: { schoolId, source: 'AI' } }),
      this.prisma.lessonProgress.count({ where: { schoolId, completed: true } }),
      this.prisma.practiceAttempt.aggregate({
        where: { schoolId, completedAt: { not: null } },
        _avg: { score: true },
        _count: true,
      }),
    ]);

    const result = {
      totalLessons,
      publishedLessons: published,
      aiGeneratedLessons: aiGenerated,
      totalCompletions: completions,
      practiceAttempts: avgPractice._count,
      avgPracticeScore: Math.round(avgPractice._avg.score ?? 0),
    };

    await this.redis.set(cacheKey, result, 180);
    return result;
  }

  async getStudentLessonReport(studentId: string, schoolId: string) {
    const [inProgress, completed, practiceData, weakTopics] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: false, progressPct: { gt: 0 } } }),
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: true } }),
      this.prisma.practiceAttempt.aggregate({
        where: { studentId, schoolId },
        _avg: { score: true },
        _count: true,
      }),
      // Find lessons with lowest performance for this student
      this.prisma.practiceAttempt.findMany({
        where: { studentId, schoolId, completedAt: { not: null } },
        include: { set: { select: { id: true, title: true } } },
        orderBy: { score: 'asc' },
        take: 3,
      }),
    ]);

    return {
      lessonsInProgress: inProgress,
      lessonsCompleted: completed,
      practiceAttempts: practiceData._count,
      avgPracticeScore: Math.round((practiceData._avg.score ?? 0)),
      weakAreas: weakTopics.map((w) => ({ setTitle: w.set.title, score: w.score, maxScore: w.maxScore })),
    };
  }

  async getSubjectBreakdown(schoolId: string) {
    const subjects = await this.prisma.lesson.groupBy({
      by: ['subject'],
      where: { schoolId, status: 'PUBLISHED', subject: { not: null } },
      _count: true,
      orderBy: { _count: { subject: 'desc' } },
    });

    return subjects.map((s) => ({ subject: s.subject, lessonCount: s._count }));
  }
}
