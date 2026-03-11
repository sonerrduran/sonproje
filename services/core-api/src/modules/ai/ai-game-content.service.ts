import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { AiCostControlService } from './ai-cost-control.service';

export interface GameQuizContent {
  questions: Array<{
    body: string;
    options: Array<{ id: string; text: string }>;
    correct: string;
    explanation: string;
    pointValue: number;
  }>;
  timeLimitSeconds: number;
  bonusTimeSeconds: number;
}

export interface DragDropContent {
  pairs: Array<{
    source: { id: string; text: string; imageHint?: string };
    target: { id: string; label: string };
  }>;
  instructions: string;
}

export interface MatchingContent {
  pairs: Array<{
    left: { id: string; text: string };
    right: { id: string; text: string };
  }>;
  instructions: string;
}

export interface WordBuilderContent {
  words: Array<{ word: string; hint: string; category: string; difficulty: string }>;
}

export interface MemoryContent {
  pairs: Array<{
    id: string;
    cardA: { text: string; emojiHint?: string };
    cardB: { text: string };
  }>;
}

@Injectable()
export class AiGameContentService {
  private readonly logger = new Logger(AiGameContentService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly costControl: AiCostControlService,
    private readonly prisma: PrismaService,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.config.get<string>('ai.geminiApiKey', ''),
    );
  }

  async generateQuizContent(ctx: PromptContext): Promise<GameQuizContent> {
    const cached = await this.costControl.getCached<GameQuizContent>('game-quiz', ctx);
    if (cached) return cached;

    const prompt = this.promptBuilder.build('game-quiz', ctx);
    const result = await this.callGemini<GameQuizContent>(prompt);
    await this.costControl.setCached('game-quiz', ctx, result);
    return result;
  }

  async generateDragDropContent(ctx: PromptContext): Promise<DragDropContent> {
    const cached = await this.costControl.getCached<DragDropContent>('game-drag-drop', ctx);
    if (cached) return cached;

    const prompt = this.promptBuilder.build('game-drag-drop', ctx);
    const result = await this.callGemini<DragDropContent>(prompt);
    await this.costControl.setCached('game-drag-drop', ctx, result);
    return result;
  }

  async generateMatchingContent(ctx: PromptContext): Promise<MatchingContent> {
    const cached = await this.costControl.getCached<MatchingContent>('game-matching', ctx);
    if (cached) return cached;

    const prompt = this.promptBuilder.build('game-matching', ctx);
    const result = await this.callGemini<MatchingContent>(prompt);
    await this.costControl.setCached('game-matching', ctx, result);
    return result;
  }

  async generateWordBuilderContent(ctx: PromptContext): Promise<WordBuilderContent> {
    const cached = await this.costControl.getCached<WordBuilderContent>('game-word-builder', ctx);
    if (cached) return cached;

    const prompt = this.promptBuilder.build('game-word-builder', ctx);
    const result = await this.callGemini<WordBuilderContent>(prompt);
    await this.costControl.setCached('game-word-builder', ctx, result);
    return result;
  }

  async generateMemoryContent(ctx: PromptContext): Promise<MemoryContent> {
    const cached = await this.costControl.getCached<MemoryContent>('game-memory', ctx);
    if (cached) return cached;

    const prompt = this.promptBuilder.build('game-memory', ctx);
    const result = await this.callGemini<MemoryContent>(prompt);
    await this.costControl.setCached('game-memory', ctx, result);
    return result;
  }

  /** Automatically generate content for any game template type */
  async generateForTemplate(
    templateId: string,
    ctx: PromptContext,
  ): Promise<Record<string, unknown>> {
    switch (templateId) {
      case 'QUIZ':         return this.generateQuizContent(ctx) as Promise<Record<string, unknown>>;
      case 'DRAG_DROP':    return this.generateDragDropContent(ctx) as Promise<Record<string, unknown>>;
      case 'MATCHING':     return this.generateMatchingContent(ctx) as Promise<Record<string, unknown>>;
      case 'WORD_BUILDER': return this.generateWordBuilderContent(ctx) as Promise<Record<string, unknown>>;
      case 'MEMORY_MATCH': return this.generateMemoryContent(ctx) as Promise<Record<string, unknown>>;
      default:
        this.logger.warn(`No AI generator for template: ${templateId}, returning empty content`);
        return {};
    }
  }

  /** Generate content for all levels of a game at once */
  async generateAllLevels(
    templateId: string,
    levelCount: number,
    baseCtx: PromptContext,
  ): Promise<Array<{ levelNum: number; content: Record<string, unknown> }>> {
    const results = [];
    const difficulties = ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard'] as Array<'easy' | 'medium' | 'hard'>;

    for (let i = 1; i <= levelCount; i++) {
      const ctx: PromptContext = {
        ...baseCtx,
        levelNum: i,
        difficulty: difficulties[Math.min(i - 1, difficulties.length - 1)],
        questionCount: Math.min(5 + i, 15), // More questions at higher levels
      };

      const content = await this.generateForTemplate(templateId, ctx);
      results.push({ levelNum: i, content });
    }

    return results;
  }

  // ─── Core Gemini caller ───────────────────────────────────

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
    const text = result.response.text();

    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error('Gemini returned invalid JSON', text.slice(0, 300));
      throw new Error('AI returned malformed data. Please retry.');
    }
  }
}
