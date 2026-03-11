import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { QuestionType, QuestionDifficulty, LessonSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

interface QuestionAnswer {
  correct: string | string[];
  explanation?: string;
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schoolId: string,
    params: {
      lessonId?: string; type?: QuestionType; difficulty?: QuestionDifficulty;
      subject?: string; search?: string; page?: number; limit?: number;
    },
  ) {
    const { lessonId, type, difficulty, subject, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      ...(lessonId && { lessonId }),
      ...(type && { type }),
      ...(difficulty && { difficulty }),
      ...(subject && { lesson: { subject } }),
      ...(search && { body: { contains: search, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.question.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.question.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string, schoolId: string) {
    const q = await this.prisma.question.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException(`Question ${id} not found`);
    return q;
  }

  async create(
    schoolId: string,
    data: {
      lessonId?: string; type: QuestionType; body: string;
      options?: QuestionOption[]; answer: QuestionAnswer;
      difficulty?: QuestionDifficulty; language?: string; tags?: string[];
      source?: LessonSource;
    },
  ) {
    const question = await this.prisma.question.create({
      data: {
        schoolId,
        lessonId: data.lessonId,
        type: data.type,
        body: data.body,
        options: data.options ? JSON.parse(JSON.stringify(data.options)) : undefined,
        answer: JSON.parse(JSON.stringify(data.answer)),
        difficulty: data.difficulty ?? QuestionDifficulty.MEDIUM,
        language: data.language ?? 'en',
        tags: data.tags ?? [],
        source: data.source ?? LessonSource.MANUAL,
      },
    });
    this.logger.log(`Question created: type=${data.type} school=${schoolId}`);
    return question;
  }

  async update(
    id: string,
    schoolId: string,
    data: Partial<{
      body: string; options: QuestionOption[]; answer: QuestionAnswer;
      difficulty: QuestionDifficulty; tags: string[];
    }>,
  ) {
    const existing = await this.prisma.question.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException(`Question ${id} not found`);

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(data.body !== undefined && { body: data.body }),
        ...(data.options !== undefined && { options: JSON.parse(JSON.stringify(data.options)) }),
        ...(data.answer !== undefined && { answer: JSON.parse(JSON.stringify(data.answer)) }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });
  }

  async remove(id: string, schoolId: string) {
    const q = await this.prisma.question.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException(`Question ${id} not found`);
    await this.prisma.question.delete({ where: { id } });
    return { message: 'Question deleted' };
  }

  async bulkCreate(schoolId: string, lessonId: string, questions: Array<{
    type: QuestionType; body: string; options?: QuestionOption[]; answer: QuestionAnswer;
    difficulty?: QuestionDifficulty; language?: string; tags?: string[]; source?: LessonSource;
  }>) {
    const created = await this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.question.create({
          data: {
            schoolId,
            lessonId,
            type: q.type,
            body: q.body,
            options: q.options ? JSON.parse(JSON.stringify(q.options)) : undefined,
            answer: JSON.parse(JSON.stringify(q.answer)),
            difficulty: q.difficulty ?? QuestionDifficulty.MEDIUM,
            language: q.language ?? 'en',
            tags: q.tags ?? [],
            source: q.source ?? LessonSource.MANUAL,
          },
        })
      ),
    );
    this.logger.log(`Bulk created ${created.length} questions for lesson ${lessonId}`);
    return { created: created.length, questions: created };
  }

  /** Get questions for a specific lesson in random order for practice */
  async getForPractice(
    lessonId: string,
    schoolId: string,
    count = 10,
    difficulty?: QuestionDifficulty,
  ) {
    const all = await this.prisma.question.findMany({
      where: { lessonId, schoolId, ...(difficulty && { difficulty }) },
    });

    // Shuffle and return requested count
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, count);
    return shuffled;
  }
}
