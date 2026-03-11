import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiLessonService, GenerateLessonInput } from './ai-lesson.service';
import { PrismaService } from '../../database/prisma.service';

interface GenerateLessonJob extends GenerateLessonInput {
  schoolId: string;
  teacherId: string;
  aiJobId: string;
}

@Processor('ai-generation')
export class AiLessonProcessor extends WorkerHost {
  private readonly logger = new Logger(AiLessonProcessor.name);

  constructor(
    private readonly aiService: AiLessonService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<GenerateLessonJob>) {
    this.logger.log(`Processing AI job: ${job.id}, type: ${job.name}`);

    if (job.name === 'generate-lesson') {
      const { schoolId, teacherId, aiJobId, ...input } = job.data;

      // Update job status to PROCESSING
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: 'PROCESSING' },
      });

      try {
        // 1. Generate lesson content via Gemini
        const generated = await this.aiService.generateLesson(input);

        // 2. Save to DB atomically
        const lesson = await this.aiService.saveGeneratedLesson(
          schoolId,
          teacherId,
          aiJobId,
          generated,
        );

        this.logger.log(`AI lesson created: ${lesson.id} for school ${schoolId}`);

        // 3. TODO: Send notification to teacher
        // await this.notificationService.notify(teacherId, { title: 'Lesson Ready', ... });

        return { lessonId: lesson.id };
      } catch (err) {
        this.logger.error(`AI generation failed for job ${aiJobId}:`, err);

        // Mark job as failed in DB
        await this.prisma.aiJob.update({
          where: { id: aiJobId },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : 'Unknown error',
            completedAt: new Date(),
          },
        });

        throw err; // BullMQ will retry with exponential backoff
      }
    }

    if (job.name === 'generate-questions') {
      const { schoolId, teacherId, aiJobId, ...input } = job.data;

      await this.prisma.aiJob.update({ where: { id: aiJobId }, data: { status: 'PROCESSING' } });

      try {
        const questions = await this.aiService.generateQuestions({
          topic: input.topic,
          subject: input.subject,
          gradeLevel: input.gradeLevel,
          language: input.language,
          count: input.questionCount,
        });

        await this.prisma.aiJob.update({
          where: { id: aiJobId },
          data: { status: 'DONE', result: { questions }, completedAt: new Date() },
        });

        return { count: questions.length };
      } catch (err) {
        await this.prisma.aiJob.update({
          where: { id: aiJobId },
          data: { status: 'FAILED', error: String(err), completedAt: new Date() },
        });
        throw err;
      }
    }
  }
}
