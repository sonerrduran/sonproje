import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { AiGameContentService } from './ai-game-content.service';
import { AiCostControlService } from './ai-cost-control.service';

interface AiJobPayload {
  aiJobId: string;
  schoolId: string;
  userId: string;
  type: string;
  ctx: PromptContext;
  templateId?: string;
  levelCount?: number;
  // lesson-specific extras (relayed from LessonsService.generateWithAI)
  teacherId?: string;
}

@Processor('ai-generation')
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly gameContent: AiGameContentService,
    private readonly costControl: AiCostControlService,
    private readonly config: ConfigService,
  ) {
    super();
    this.genAI = new GoogleGenerativeAI(config.get<string>('ai.geminiApiKey', ''));
  }

  async process(job: Job<AiJobPayload>) {
    const { aiJobId, schoolId, ctx, type, templateId, levelCount, teacherId } = job.data;
    this.logger.log(`Processing AI job [${aiJobId}] type: ${type}`);

    await this.prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: 'PROCESSING' },
    });

    try {
      let result: unknown;

      switch (type) {
        case 'lesson':
        case 'generate-lesson': {
          result = await this.generateLesson(aiJobId, schoolId, teacherId ?? job.data.userId, ctx);
          break;
        }
        case 'generate-questions':
        case 'questions': {
          const prompt = this.promptBuilder.build('questions', ctx);
          result = await this.callGemini(prompt);
          break;
        }
        case 'generate-game-content':
        case 'game-content': {
          if (levelCount && levelCount > 1) {
            result = await this.gameContent.generateAllLevels(templateId!, levelCount, ctx);
          } else {
            result = await this.gameContent.generateForTemplate(templateId ?? 'QUIZ', ctx);
          }
          break;
        }
        default:
          throw new Error(`Unknown AI job type: ${type}`);
      }

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: 'DONE', result: result as object, completedAt: new Date() },
      });

      this.logger.log(`AI job [${aiJobId}] completed`);
      return { aiJobId, status: 'DONE' };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI job [${aiJobId}] failed: ${error}`);

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: 'FAILED', error, completedAt: new Date() },
      }).catch(() => {});

      throw err; // BullMQ retry with exponential backoff
    }
  }

  private async generateLesson(
    aiJobId: string,
    schoolId: string,
    teacherId: string,
    ctx: PromptContext,
  ) {
    const prompt = this.promptBuilder.build('lesson', ctx);
    const generated = await this.callGemini<{
      title: string; introduction: string;
      contentBlocks: Array<{ type: string; content: string }>;
      summary: string;
      questions: Array<{ type: string; body: string; options?: object; answer: object; difficulty: string }>;
      tags: string[];
    }>(prompt);

    // Atomically create lesson + blocks + questions
    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({
        data: {
          schoolId,
          teacherId,
          title: generated.title,
          source: 'AI',
          status: 'DRAFT',
          tags: generated.tags ?? [],
        },
      });

      const blocks = [
        { type: 'TEXT', content: generated.introduction, orderNum: 1 },
        ...generated.contentBlocks.map((b, i) => ({ type: b.type, content: b.content, orderNum: i + 2 })),
        { type: 'TEXT', content: generated.summary, orderNum: generated.contentBlocks.length + 2 },
      ];

      await tx.lessonContentBlock.createMany({
        data: blocks.map((b) => ({ lessonId: lesson.id, ...b, metadata: {} })),
      });

      for (const q of generated.questions) {
        await tx.question.create({
          data: {
            schoolId,
            lessonId: lesson.id,
            type: q.type as never,
            body: q.body,
            options: q.options ? JSON.parse(JSON.stringify(q.options)) : undefined,
            answer: JSON.parse(JSON.stringify(q.answer)),
            difficulty: q.difficulty as never,
            source: 'AI',
          },
        });
      }

      await tx.aiJob.update({
        where: { id: aiJobId },
        data: { result: { lessonId: lesson.id } as object },
      });

      return { lessonId: lesson.id, title: lesson.title };
    });
  }

  private async callGemini<T>(prompt: string): Promise<T> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: { temperature: 0.35, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as T;
  }
}
