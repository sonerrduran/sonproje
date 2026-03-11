import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LessonStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('ai-generation') private readonly aiQueue: Queue,
  ) {}

  async findAll(schoolId: string, params: {
    status?: string; subject?: string; search?: string;
    page?: number; limit?: number;
  }) {
    const { status, subject, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      ...(status && { status: status as LessonStatus }),
      ...(subject && { subject }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { tags: { has: search } },
        ],
      }),
    };

    const [lessons, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        include: { _count: { select: { contentBlocks: true, questions: true } } },
        skip, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { data: lessons, meta: { total, page, limit } };
  }

  async findById(id: string, schoolId: string) {
    const cacheKey = `lesson:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const lesson = await this.prisma.lesson.findFirst({
      where: { id, schoolId },
      include: { contentBlocks: { orderBy: { orderNum: 'asc' } }, questions: true },
    });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);

    await this.redis.set(cacheKey, lesson, 300);
    return lesson;
  }

  async create(schoolId: string, teacherId: string, data: {
    title: string; subject?: string; gradeLevel?: string; language?: string; tags?: string[];
  }) {
    const lesson = await this.prisma.lesson.create({
      data: { ...data, schoolId, teacherId, source: 'MANUAL' },
    });
    this.logger.log(`Lesson created: ${lesson.title} [school: ${schoolId}]`);
    return lesson;
  }

  async update(id: string, schoolId: string, data: Record<string, unknown>) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id, schoolId } });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);

    const updated = await this.prisma.lesson.update({ where: { id }, data });
    await this.redis.del(`lesson:${id}`);
    return updated;
  }

  async publish(id: string, schoolId: string) {
    return this.update(id, schoolId, { status: 'PUBLISHED' });
  }

  async generateWithAI(schoolId: string, teacherId: string, data: {
    topic: string; subject: string; gradeLevel: string; language: string; objectives?: string[];
  }) {
    const job = await this.aiQueue.add('generate-lesson', {
      schoolId, teacherId, ...data,
    });
    this.logger.log(`AI lesson generation queued: job ${job.id}`);
    return { jobId: job.id, status: 'queued', message: 'AI is generating your lesson. You will be notified when it\'s ready.' };
  }

  async assign(id: string, schoolId: string, teacherId: string, data: {
    classroomIds?: string[]; studentIds?: string[]; dueDate?: string;
  }) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id, schoolId, status: 'PUBLISHED' } });
    if (!lesson) throw new NotFoundException('Published lesson not found');

    const assignments = await Promise.all([
      ...(data.classroomIds ?? []).map((classroomId) =>
        this.prisma.lessonAssignment.create({
          data: { lessonId: id, schoolId, teacherId, classroomId, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
        })
      ),
      ...(data.studentIds ?? []).map((studentId) =>
        this.prisma.lessonAssignment.create({
          data: { lessonId: id, schoolId, teacherId, studentId, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
        })
      ),
    ]);

    return { assigned: assignments.length };
  }

  async markProgress(lessonId: string, studentId: string, schoolId: string, progressPct: number) {
    const completed = progressPct >= 100;
    return this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, schoolId, progressPct, completed, startedAt: new Date(), completedAt: completed ? new Date() : undefined },
      update: { progressPct, completed, ...(completed ? { completedAt: new Date() } : {}) },
    });
  }
}
