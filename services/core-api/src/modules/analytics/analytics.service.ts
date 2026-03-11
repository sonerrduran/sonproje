import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
  ) {}

  /** Emit a learning event (fire-and-forget via queue) */
  async track(event: {
    schoolId: string; userId: string; eventType: string;
    entityType?: string; entityId?: string; data?: Record<string, unknown>;
  }) {
    await this.analyticsQueue.add('track-event', event);
  }

  async getSchoolDashboard(schoolId: string) {
    const [activeLearners, lessonsCompleted, gamePlays, recentEvents] = await Promise.all([
      this.prisma.user.count({ where: { schoolId, status: 'ACTIVE', role: 'STUDENT' } }),
      this.prisma.lessonProgress.count({ where: { schoolId, completed: true } }),
      this.prisma.gameProgress.count({ where: { schoolId } }),
      this.prisma.learningEvent.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return { activeLearners, lessonsCompleted, gamePlays, recentEvents };
  }

  async getStudentReport(studentId: string, schoolId: string) {
    const [xpTotal, lessonsCompleted, practiceAttempts, gameSessions] = await Promise.all([
      this.prisma.xpLog.aggregate({ where: { userId: studentId }, _sum: { amount: true } }),
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: true } }),
      this.prisma.practiceAttempt.aggregate({
        where: { studentId, schoolId },
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.gameProgress.count({ where: { studentId } }),
    ]);

    return {
      totalXp: xpTotal._sum.amount ?? 0,
      level: Math.floor(Math.sqrt((xpTotal._sum.amount ?? 0) / 100)) + 1,
      lessonsCompleted,
      practiceAttempts: practiceAttempts._count,
      avgPracticeScore: Math.round(practiceAttempts._avg.score ?? 0),
      gameSessions,
    };
  }

  async getClassroomReport(classroomId: string, schoolId: string) {
    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });

    const reports = await Promise.all(
      students.map(async (s) => ({
        student: s.student,
        stats: await this.getStudentReport(s.studentId, schoolId),
      })),
    );

    return { classroomId, studentCount: students.length, reports };
  }
}
