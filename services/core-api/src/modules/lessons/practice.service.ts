import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface AttemptAnswer {
  questionId: string;
  answer: string | string[];
  timeMs?: number;
}

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Practice Sets ────────────────────────────────────────

  async createSet(
    schoolId: string,
    teacherId: string,
    data: {
      title: string;
      questionIds: string[];
      config?: { timed?: boolean; timeLimit?: number; shuffle?: boolean; maxAttempts?: number };
    },
  ) {
    if (data.questionIds.length === 0) {
      throw new BadRequestException('A practice set must have at least 1 question');
    }

    const set = await this.prisma.$transaction(async (tx) => {
      const created = await tx.practiceSet.create({
        data: { schoolId, teacherId, title: data.title, config: data.config ?? {} },
      });
      await tx.practiceSetItem.createMany({
        data: data.questionIds.map((questionId, idx) => ({
          setId: created.id,
          questionId,
          orderNum: idx + 1,
        })),
      });
      return created;
    });

    this.logger.log(`Practice set created: "${data.title}" [${data.questionIds.length} questions]`);
    return set;
  }

  async findSet(setId: string, schoolId: string) {
    const set = await this.prisma.practiceSet.findFirst({
      where: { id: setId, schoolId },
      include: {
        items: {
          include: { question: true },
          orderBy: { orderNum: 'asc' },
        },
      },
    });
    if (!set) throw new NotFoundException(`Practice set ${setId} not found`);
    return set;
  }

  async listSets(schoolId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.practiceSet.findMany({
        where: { schoolId },
        include: { _count: { select: { items: true, attempts: true } } },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.practiceSet.count({ where: { schoolId } }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ─── Lesson Quick-Practice ────────────────────────────────

  /** Get a practice session directly from a lesson's questions */
  async getLessonPractice(
    lessonId: string,
    schoolId: string,
    count = 10,
  ) {
    const questions = await this.prisma.question.findMany({
      where: { lessonId, schoolId },
      orderBy: { difficulty: 'asc' },
      take: count,
    });

    if (questions.length === 0) {
      throw new NotFoundException('No questions available for practice in this lesson');
    }

    // Return without answers (strip the answer field for the quiz experience)
    return questions.map(({ answer: _, ...q }) => q);
  }

  // ─── Attempts ─────────────────────────────────────────────

  async startAttempt(setId: string, studentId: string, schoolId: string) {
    const set = await this.prisma.practiceSet.findFirst({ where: { id: setId, schoolId } });
    if (!set) throw new NotFoundException('Practice set not found');

    const config = set.config as Record<string, unknown>;

    // Check max attempts
    if (config?.maxAttempts) {
      const existingCount = await this.prisma.practiceAttempt.count({ where: { setId, studentId } });
      if (existingCount >= Number(config.maxAttempts)) {
        throw new BadRequestException(`Maximum attempts (${config.maxAttempts}) reached`);
      }
    }

    const attempt = await this.prisma.practiceAttempt.create({
      data: { studentId, setId, schoolId, score: 0, maxScore: 0, answers: [] },
    });

    // Cache attempt start time
    await this.redis.set(`attempt:${attempt.id}:start`, Date.now(), 7200);

    return { attemptId: attempt.id, startedAt: attempt.startedAt };
  }

  async submitAttempt(
    attemptId: string,
    studentId: string,
    schoolId: string,
    answers: AttemptAnswer[],
  ) {
    const attempt = await this.prisma.practiceAttempt.findFirst({
      where: { id: attemptId, studentId, completedAt: null },
      include: { set: { include: { items: { include: { question: true } } } } },
    });

    if (!attempt) throw new NotFoundException('Active attempt not found');

    // Grade each answer
    const gradedAnswers = answers.map((submitted) => {
      const item = attempt.set.items.find((i) => i.questionId === submitted.questionId);
      if (!item) return { ...submitted, correct: false };

      const correctAnswer = (item.question.answer as Record<string, unknown>).correct;
      const isCorrect = Array.isArray(correctAnswer)
        ? JSON.stringify([...(submitted.answer as string[])].sort()) ===
          JSON.stringify([...(correctAnswer as string[])].sort())
        : submitted.answer === correctAnswer;

      return {
        questionId: submitted.questionId,
        answer: submitted.answer,
        correct: isCorrect,
        timeMs: submitted.timeMs,
        explanation: (item.question.answer as Record<string, unknown>).explanation,
      };
    });

    const score = gradedAnswers.filter((a) => a.correct).length;
    const maxScore = attempt.set.items.length;

    const completed = await this.prisma.practiceAttempt.update({
      where: { id: attemptId },
      data: {
        answers: gradedAnswers,
        score,
        maxScore,
        completedAt: new Date(),
      },
    });

    const percentage = Math.round((score / maxScore) * 100);

    // Award XP: 5pt per correct answer
    if (score > 0) {
      await this.prisma.xpLog.create({
        data: { userId: studentId, schoolId, amount: score * 5, reason: 'practice_correct', entityId: attemptId },
      });
    }

    this.logger.log(`Attempt ${attemptId} submitted: ${score}/${maxScore} (${percentage}%)`);

    return {
      attemptId,
      score,
      maxScore,
      percentage,
      gradedAnswers,
      completedAt: completed.completedAt,
    };
  }

  async getAttemptHistory(studentId: string, schoolId: string, setId?: string) {
    return this.prisma.practiceAttempt.findMany({
      where: { studentId, schoolId, ...(setId && { setId }) },
      include: { set: { select: { id: true, title: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}
