import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { AiCostControlService } from './ai-cost-control.service';
import { AiGameContentService } from './ai-game-content.service';

interface GenerationRequest {
  schoolId: string;
  userId: string;
  type: 'lesson' | 'questions' | 'explanation' | 'summary' | 'game-content';
  ctx: PromptContext;
  templateId?: string;   // for game-content type
  levelCount?: number;   // for game-content bulk
  async?: boolean;       // false = immediate (small), true = queued (big)
}

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly costControl: AiCostControlService,
    private readonly gameContent: AiGameContentService,
    @InjectQueue('ai-generation') private readonly aiQueue: Queue,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.config.get<string>('ai.geminiApiKey', ''),
    );
  }

  // ─── Main entry point ──────────────────────────────────────

  async generate(req: GenerationRequest) {
    // 1. Rate limit check
    await this.costControl.checkRateLimit(req.schoolId);

    // 2. Big jobs → queue; small ones → immediate
    if (req.async || req.type === 'lesson') {
      return this.enqueue(req);
    }
    return this.generateImmediate(req);
  }

  // ─── Immediate (small request) ────────────────────────────

  async generateImmediate(req: GenerationRequest) {
    const { type, ctx, templateId, levelCount } = req;

    // Check cache first
    const cached = await this.costControl.getCached(type as never, ctx);
    if (cached) return { source: 'cache', data: cached };

    let result: unknown;

    switch (type) {
      case 'questions':
        result = await this.callGemini(this.promptBuilder.build('questions', ctx));
        break;
      case 'explanation':
        result = await this.callGemini(this.promptBuilder.build('explanation', ctx));
        break;
      case 'summary':
        result = await this.callGemini(this.promptBuilder.build('summary', ctx));
        break;
      case 'game-content':
        if (levelCount && levelCount > 1) {
          result = await this.gameContent.generateAllLevels(templateId!, levelCount, ctx);
        } else {
          result = await this.gameContent.generateForTemplate(templateId!, ctx);
        }
        break;
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }

    // Cache result
    await this.costControl.setCached(type as never, ctx, result);
    return { source: 'ai', data: result };
  }

  // ─── Async (queue big jobs) ────────────────────────────────

  private async enqueue(req: GenerationRequest) {
    // Create AiJob record first
    const aiJob = await this.prisma.aiJob.create({
      data: {
        schoolId: req.schoolId,
        userId: req.userId,
        type: req.type.toUpperCase().replace('-', '_'),
        status: 'PENDING',
        prompt: `${req.ctx.subject}:${req.ctx.topic}:${req.ctx.gradeLevel}`,
      },
    });

    await this.aiQueue.add(
      `generate-${req.type}`,
      { ...req, aiJobId: aiJob.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.logger.log(`AI job queued: ${req.type} [job: ${aiJob.id}]`);
    return {
      jobId: aiJob.id,
      status: 'PENDING',
      message: 'Your content is being generated. Check status at GET /ai/jobs/:id',
    };
  }

  // ─── Job status ────────────────────────────────────────────

  async getJobStatus(jobId: string, schoolId: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { id: jobId, schoolId },
    });
    if (!job) throw new Error('AI job not found');
    return job;
  }

  async getJobHistory(schoolId: string, limit = 20) {
    return this.prisma.aiJob.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, type: true, status: true, prompt: true,
        error: true, createdAt: true, completedAt: true,
      },
    });
  }

  // ─── Usage / cost ─────────────────────────────────────────

  async getUsageSummary(schoolId: string) {
    return this.costControl.getUsageSummary(schoolId);
  }

  // ─── Core Gemini caller ───────────────────────────────────

  private async callGemini<T>(prompt: string): Promise<T> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: this.config.get<number>('ai.maxTokensPerRequest', 2048),
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as T;
  }
}
