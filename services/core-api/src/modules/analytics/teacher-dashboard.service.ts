import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TeacherDashboardService {
  private readonly logger = new Logger(TeacherDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Class Overview ───────────────────────────────────────

  async getClassDashboard(classroomId: string, schoolId: string) {
    const cacheKey = `dashboard:teacher:class:${classroomId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId },
      select: { studentId: true },
    });
    const studentIds = students.map((s) => s.studentId);
    const totalStudents = studentIds.length;

    const [
      lessonCompletion,
      gameCompletion,
      practiceStats,
      atRisk,
      topPerformers,
      mostActiveStudents,
    ] = await Promise.all([
      this.getLessonCompletion(classroomId, schoolId, studentIds, totalStudents),
      this.getGameCompletion(classroomId, studentIds),
      this.getPracticeStats(studentIds, schoolId),
      this.getAtRiskStudents(studentIds, schoolId),
      this.getTopPerformers(studentIds, schoolId),
      this.getMostActiveStudents(studentIds),
    ]);

    const result = {
      totalStudents,
      lessonCompletion,
      gameCompletion,
      practiceStats,
      atRisk,
      topPerformers,
      mostActiveStudents,
    };

    await this.redis.set(cacheKey, result, 300); // 5-min cache
    return result;
  }

  // ─── Student Comparison ───────────────────────────────────

  async getStudentComparison(classroomId: string, schoolId: string) {
    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const comparison = await Promise.all(
      students.map(async ({ student }) => {
        const [lessonsDone, gamesDone, xpAgg, lastActive] = await Promise.all([
          this.prisma.lessonProgress.count({ where: { studentId: student.id, schoolId, completed: true } }),
          this.prisma.gameProgress.count({ where: { studentId: student.id } }),
          this.prisma.xpLog.aggregate({ where: { userId: student.id }, _sum: { amount: true } }),
          this.prisma.learningEvent.findFirst({
            where: { userId: student.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);

        return {
          student,
          lessonsCompleted: lessonsDone,
          gamesPlayed: gamesDone,
          totalXp: xpAgg._sum.amount ?? 0,
          lastActive: lastActive?.createdAt ?? null,
          isAtRisk: !lastActive || lastActive.createdAt < new Date(Date.now() - 7 * 86_400_000),
        };
      }),
    );

    return comparison.sort((a, b) => b.totalXp - a.totalXp);
  }

  // ─── Weak Topics for Class ────────────────────────────────

  async getClassWeakTopics(classroomId: string, schoolId: string) {
    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId },
      select: { studentId: true },
    });
    const studentIds = students.map((s) => s.studentId);

    const attempts = await this.prisma.practiceAttempt.findMany({
      where: { studentId: { in: studentIds }, schoolId, completedAt: { not: null } },
      include: {
        set: {
          include: {
            items: { include: { question: { select: { tags: true } } } },
          },
        },
      },
      take: 200,
    });

    const tagMap = new Map<string, { total: number; count: number }>();
    for (const attempt of attempts) {
      const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
      const tags = attempt.set.items.flatMap((i) => i.question.tags ?? []);
      for (const tag of tags) {
        const cur = tagMap.get(tag) ?? { total: 0, count: 0 };
        tagMap.set(tag, { total: cur.total + pct, count: cur.count + 1 });
      }
    }

    return Array.from(tagMap.entries())
      .filter(([, v]) => v.count >= 3)
      .map(([tag, v]) => ({ topic: tag, avgScore: Math.round(v.total / v.count), attempts: v.count }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 8);
  }

  // ─── Lesson Analytics ─────────────────────────────────────

  async getLessonAnalytics(schoolId: string) {
    const cacheKey = `analytics:lessons:${schoolId}:teacher`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const lessons = await this.prisma.lesson.findMany({
      where: { schoolId, status: 'PUBLISHED' },
      include: {
        _count: { select: { progress: true } },
      },
      take: 50,
    });

    const detailed = await Promise.all(
      lessons.map(async (lesson) => {
        const [completed, total, avgProgress] = await Promise.all([
          this.prisma.lessonProgress.count({ where: { lessonId: lesson.id, completed: true } }),
          this.prisma.lessonAssignment.count({ where: { lessonId: lesson.id } }),
          this.prisma.lessonProgress.aggregate({
            where: { lessonId: lesson.id },
            _avg: { progressPct: true },
          }),
        ]);

        return {
          lessonId: lesson.id,
          title: lesson.title,
          subject: lesson.subject,
          source: lesson.source,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          totalAssigned: total,
          totalCompleted: completed,
          avgProgress: Math.round(avgProgress._avg.progressPct ?? 0),
        };
      }),
    );

    const result = detailed.sort((a, b) => b.completionRate - a.completionRate);
    await this.redis.set(cacheKey, result, 300);
    return result;
  }

  // ─── Game Analytics ───────────────────────────────────────

  async getGameAnalytics(schoolId: string) {
    const games = await this.prisma.game.findMany({
      where: { schoolId, status: 'PUBLISHED' },
      include: { _count: { select: { progress: true } } },
      take: 50,
    });

    const detailed = await Promise.all(
      games.map(async (game) => {
        const [plays, avgScore, avgLevels] = await Promise.all([
          this.prisma.gameProgress.count({ where: { gameId: game.id } }),
          this.prisma.gameProgress.aggregate({ where: { gameId: game.id }, _avg: { totalScore: true } }),
          this.prisma.gameProgress.aggregate({ where: { gameId: game.id }, _avg: { levelsCompleted: true } }),
        ]);

        const totalLevels = await this.prisma.gameLevel.count({ where: { gameId: game.id } });

        return {
          gameId: game.id,
          title: game.title,
          templateId: game.templateId,
          subject: game.subject,
          totalPlays: plays,
          avgScore: Math.round(avgScore._avg.totalScore ?? 0),
          avgLevelReached: Math.round(avgLevels._avg.levelsCompleted ?? 0),
          totalLevels,
          completionRate: totalLevels > 0 ? Math.round(((avgLevels._avg.levelsCompleted ?? 0) / totalLevels) * 100) : 0,
        };
      }),
    );

    return detailed.sort((a, b) => b.totalPlays - a.totalPlays);
  }

  // ─── Private helpers ──────────────────────────────────────

  private async getLessonCompletion(
    classroomId: string, schoolId: string, studentIds: string[], total: number,
  ) {
    const assignments = await this.prisma.lessonAssignment.count({ where: { classroomId } });
    if (assignments === 0 || total === 0) return { rate: 0, completedCount: 0, totalAssigned: 0 };

    const completed = await this.prisma.lessonProgress.count({
      where: { studentId: { in: studentIds }, schoolId, completed: true },
    });

    return {
      rate: Math.round((completed / (assignments * total)) * 100),
      completedCount: completed,
      totalAssigned: assignments * total,
    };
  }

  private async getGameCompletion(classroomId: string, studentIds: string[]) {
    const assignments = await this.prisma.gameAssignment.count({ where: { classroomId } });
    if (assignments === 0) return { rate: 0, totalPlays: 0 };

    const plays = await this.prisma.gameProgress.count({
      where: { studentId: { in: studentIds } },
    });

    return { rate: Math.min(100, Math.round((plays / (assignments * studentIds.length)) * 100)), totalPlays: plays };
  }

  private async getPracticeStats(studentIds: string[], schoolId: string) {
    const stats = await this.prisma.practiceAttempt.aggregate({
      where: { studentId: { in: studentIds }, schoolId, completedAt: { not: null } },
      _count: true, _avg: { score: true },
    });
    return { totalAttempts: stats._count, avgScore: Math.round(stats._avg.score ?? 0) };
  }

  private async getAtRiskStudents(studentIds: string[], schoolId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const atRisk = [];

    for (const id of studentIds.slice(0, 30)) {
      const lastEvent = await this.prisma.learningEvent.findFirst({
        where: { userId: id, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      });
      if (!lastEvent) {
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: { id: true, firstName: true, lastName: true },
        });
        if (user) atRisk.push(user);
      }
    }
    return atRisk.slice(0, 5);
  }

  private async getTopPerformers(studentIds: string[], schoolId: string) {
    const top = await this.prisma.xpLog.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds }, schoolId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    return Promise.all(
      top.map(async (t) => {
        const user = await this.prisma.user.findUnique({
          where: { id: t.userId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        return { ...user, totalXp: t._sum.amount ?? 0 };
      }),
    );
  }

  private async getMostActiveStudents(studentIds: string[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const activity = await this.prisma.learningEvent.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    return Promise.all(
      activity.map(async (a) => {
        const user = await this.prisma.user.findUnique({
          where: { id: a.userId },
          select: { id: true, firstName: true, lastName: true },
        });
        return { ...user, eventCount: a._count };
      }),
    );
  }
}
