import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface GenerateLessonInput {
  topic: string;
  subject: string;
  gradeLevel: string;
  language?: string;
  objectives?: string[];
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface GeneratedLesson {
  title: string;
  introduction: string;
  contentBlocks: Array<{
    type: 'HEADING' | 'TEXT' | 'EXAMPLE' | 'DEFINITION' | 'NOTE';
    content: string;
  }>;
  summary: string;
  questions: Array<{
    type: 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK';
    body: string;
    options?: Array<{ id: string; text: string }>;
    answer: { correct: string | string[]; explanation: string };
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  }>;
  tags: string[];
}

@Injectable()
export class AiLessonService {
  private readonly logger = new Logger(AiLessonService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string = 'gemini-2.0-flash';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const apiKey = this.config.get<string>('ai.geminiApiKey');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set — AI lesson generation will fail at runtime');
    }
    this.genAI = new GoogleGenerativeAI(apiKey ?? '');
  }

  // ─── Main generation entry point ─────────────────────────

  async generateLesson(input: GenerateLessonInput): Promise<GeneratedLesson> {
    const cacheKey = `ai:lesson:${this.hashInput(input)}`;
    const cached = await this.redis.get<GeneratedLesson>(cacheKey);
    if (cached) {
      this.logger.log('Returning cached AI lesson');
      return cached;
    }

    const prompt = this.buildLessonPrompt(input);
    const result = await this.callGemini(prompt);
    const lesson = this.parseLessonResponse(result);

    // Cache for 1 hour to avoid duplicate API calls for same topic
    await this.redis.set(cacheKey, lesson, 3600);
    return lesson;
  }

  async generateQuestions(params: {
    topic: string; subject: string; gradeLevel: string;
    count?: number; language?: string; difficulty?: string;
  }): Promise<GeneratedLesson['questions']> {
    const prompt = this.buildQuestionsPrompt(params);
    const result = await this.callGemini(prompt);
    return this.parseQuestionsResponse(result);
  }

  // ─── Core Prisma integration — save to DB ─────────────────

  async saveGeneratedLesson(
    schoolId: string,
    teacherId: string,
    aiJobId: string,
    generated: GeneratedLesson,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the lesson
      const lesson = await tx.lesson.create({
        data: {
          schoolId,
          teacherId,
          title: generated.title,
          source: 'AI',
          status: 'DRAFT',
          tags: generated.tags,
        },
      });

      // 2. Add content blocks
      const allBlocks = [
        { type: 'TEXT' as const, content: generated.introduction, orderNum: 1 },
        ...generated.contentBlocks.map((b, i) => ({
          type: b.type,
          content: b.content,
          orderNum: i + 2,
        })),
        { type: 'TEXT' as const, content: generated.summary, orderNum: generated.contentBlocks.length + 2 },
      ];

      await tx.lessonContentBlock.createMany({
        data: allBlocks.map((b) => ({ lessonId: lesson.id, ...b, metadata: {} })),
      });

      // 3. Create questions
      for (const q of generated.questions) {
        await tx.question.create({
          data: {
            schoolId,
            lessonId: lesson.id,
            type: q.type,
            body: q.body,
            options: q.options ? JSON.parse(JSON.stringify(q.options)) : undefined,
            answer: JSON.parse(JSON.stringify(q.answer)),
            difficulty: q.difficulty,
            source: 'AI',
          },
        });
      }

      // 4. Mark AI job as done
      await tx.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: 'DONE',
          result: { lessonId: lesson.id },
          completedAt: new Date(),
        },
      });

      return lesson;
    });
  }

  // ─── Prompt Builders ──────────────────────────────────────

  private buildLessonPrompt(input: GenerateLessonInput): string {
    const objectives =
      input.objectives?.length
        ? `Learning objectives:\n${input.objectives.map((o) => `- ${o}`).join('\n')}\n`
        : '';

    return `You are an expert educational content creator.

Generate a structured lesson in ${input.language ?? 'English'} for:
- Subject: ${input.subject}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
${objectives}
Create ${input.questionCount ?? 5} practice questions of difficulty: ${input.difficulty ?? 'medium'}.

You MUST respond with ONLY valid JSON (no markdown, no prose) matching this exact schema:
{
  "title": "...",
  "introduction": "...",
  "contentBlocks": [
    { "type": "HEADING|TEXT|EXAMPLE|DEFINITION|NOTE", "content": "..." }
  ],
  "summary": "...",
  "questions": [
    {
      "type": "MCQ|TRUE_FALSE|FILL_BLANK",
      "body": "...",
      "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
      "answer": { "correct": "a", "explanation": "..." },
      "difficulty": "EASY|MEDIUM|HARD"
    }
  ],
  "tags": ["tag1", "tag2"]
}

For TRUE_FALSE questions, options should be [{"id":"true","text":"True"},{"id":"false","text":"False"}].
For FILL_BLANK, omit options and set answer.correct to the expected word/phrase.
Include at least 4 content blocks (heading, text, example, note).`;
  }

  private buildQuestionsPrompt(params: {
    topic: string; subject: string; gradeLevel: string;
    count?: number; language?: string; difficulty?: string;
  }): string {
    return `You are an expert educator. Generate ${params.count ?? 10} practice questions in ${params.language ?? 'English'} for:
- Subject: ${params.subject}
- Topic: ${params.topic}
- Grade: ${params.gradeLevel}
- Difficulty: ${params.difficulty ?? 'medium'}

Respond with ONLY valid JSON array matching:
[{
  "type": "MCQ|TRUE_FALSE|FILL_BLANK",
  "body": "...",
  "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
  "answer": { "correct": "a", "explanation": "..." },
  "difficulty": "EASY|MEDIUM|HARD"
}]`;
  }

  // ─── Gemini API caller ────────────────────────────────────

  private async callGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: this.config.get<number>('ai.maxTokensPerRequest', 2048),
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    this.logger.debug(`Gemini response length: ${text.length} chars`);
    return text;
  }

  // ─── Response parsers ─────────────────────────────────────

  private parseLessonResponse(raw: string): GeneratedLesson {
    try {
      const parsed = JSON.parse(raw) as GeneratedLesson;
      if (!parsed.title || !parsed.contentBlocks || !parsed.questions) {
        throw new Error('Missing required fields');
      }
      return parsed;
    } catch (err) {
      this.logger.error('Failed to parse Gemini lesson response', raw.slice(0, 200));
      throw new Error('AI returned malformed lesson data. Please try again.');
    }
  }

  private parseQuestionsResponse(raw: string): GeneratedLesson['questions'] {
    try {
      const parsed = JSON.parse(raw) as GeneratedLesson['questions'];
      if (!Array.isArray(parsed)) throw new Error('Expected array');
      return parsed;
    } catch {
      this.logger.error('Failed to parse Gemini questions response', raw.slice(0, 200));
      throw new Error('AI returned malformed questions data. Please try again.');
    }
  }

  private hashInput(input: GenerateLessonInput): string {
    const str = `${input.topic}:${input.subject}:${input.gradeLevel}:${input.language}:${input.difficulty}:${input.questionCount}`;
    return Buffer.from(str).toString('base64').slice(0, 32);
  }
}
