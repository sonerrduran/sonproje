import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TranslationService } from './translation.service';

interface TranslationTarget {
  entityType: 'lesson' | 'game' | 'question' | 'game_level';
  entityId: string;
  fields: Record<string, string>; // field -> original text
}

interface BlockTranslationTarget {
  blockId: string;
  content: string;
}

@Injectable()
export class AiTranslationService {
  private readonly logger = new Logger(AiTranslationService.name);
  private readonly apiKey: string;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
  ) {
    this.apiKey = this.config.get<string>('ai.geminiApiKey') ?? '';
  }

  // ── Core translation call to Gemini ───────────────────────
  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,      // Low temperature for accurate translation
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // ── Translate entity content (lesson/game/question) ───────
  async translateEntity(
    target: TranslationTarget,
    targetLanguage: string,
    jobId: string,
    sourceLang = 'en',
  ): Promise<{ tokensUsed: number; fieldsDone: number }> {
    const fieldEntries = Object.entries(target.fields);
    let tokensUsed = 0;
    let fieldsDone = 0;

    // Update job status
    await this.translationService.updateTranslationJob(jobId, {
      status: 'PROCESSING',
      startedAt: new Date(),
    });

    // Build a single batch prompt to reduce API calls
    const fieldsList = fieldEntries
      .map(([field, text], i) => `[FIELD_${i}:${field}]\n${text}`)
      .join('\n\n');

    const prompt = `You are a professional educational content translator.
Translate the following educational content from ${sourceLang} to ${targetLanguage}.
Preserve formatting, educational terminology, and mathematical expressions.
Return ONLY the translations in the exact same format as input (keep the [FIELD_N:name] markers).
Do NOT add explanations or extra text.

${fieldsList}`;

    try {
      const raw = await this.callGemini(prompt);

      // Parse response: extract [FIELD_N:field_name] blocks
      for (let i = 0; i < fieldEntries.length; i++) {
        const [field] = fieldEntries[i];
        const match = raw.match(
          new RegExp(`\\[FIELD_${i}:${field}\\]\\s*([\\s\\S]*?)(?=\\[FIELD_|$)`, 'i'),
        );
        if (match?.[1]) {
          const translatedValue = match[1].trim();
          await this.translationService.upsertLocalizedContent(
            target.entityType,
            target.entityId,
            targetLanguage,
            field,
            translatedValue,
            true, // isAiGenerated
          );
          fieldsDone++;
        }
      }

      // Rough token estimate (4 chars ≈ 1 token)
      tokensUsed = Math.ceil((prompt.length + raw.length) / 4);

      await this.translationService.updateTranslationJob(jobId, {
        status: fieldsDone === fieldEntries.length ? 'DONE' : 'PARTIAL',
        fieldsDone,
        tokensUsed,
        completedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.error(`Translation failed for ${target.entityType}:${target.entityId}`, err);
      await this.translationService.updateTranslationJob(jobId, {
        status: 'FAILED',
        error: err.message,
        completedAt: new Date(),
      });
    }

    return { tokensUsed, fieldsDone };
  }

  // ── Translate lesson content blocks ───────────────────────
  async translateBlocks(
    blocks: BlockTranslationTarget[],
    targetLanguage: string,
    sourceLang = 'en',
  ): Promise<void> {
    if (blocks.length === 0) return;

    // Process in batches of 10 to avoid token limits
    const batchSize = 10;
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      const prompt = `Translate the following educational content blocks from ${sourceLang} to ${targetLanguage}.
Return JSON array with same structure: [{"blockId":"...", "content":"...translated..."}]
Preserve markdown, HTML tags, and mathematical notation exactly.

Input: ${JSON.stringify(batch.map((b) => ({ blockId: b.blockId, content: b.content })))}`;

      try {
        const raw = await this.callGemini(prompt);
        // Extract JSON from response
        const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const translated = JSON.parse(jsonMatch[0]) as {
            blockId: string;
            content: string;
          }[];
          for (const { blockId, content } of translated) {
            await this.translationService.upsertBlockTranslation(
              blockId,
              targetLanguage,
              content,
              true,
            );
          }
        }
      } catch (err: any) {
        this.logger.error(`Block translation batch failed`, err);
      }
    }
  }

  // ── Translate a lesson (full pipeline) ────────────────────
  async translateLesson(lessonId: string, targetLanguage: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { contentBlocks: true },
    });

    const fields: Record<string, string> = {
      title: lesson.title,
    };
    if (lesson.subject) fields['subject'] = lesson.subject;

    // Create translation job
    const job = await this.translationService.createTranslationJob(
      'lesson',
      lessonId,
      targetLanguage,
      Object.keys(fields).length + lesson.contentBlocks.length,
      lesson.language,
    );

    // Translate metadata fields
    await this.translateEntity(
      { entityType: 'lesson', entityId: lessonId, fields },
      targetLanguage,
      job.id,
      lesson.language,
    );

    // Translate content blocks
    await this.translateBlocks(
      lesson.contentBlocks.map((b) => ({ blockId: b.id, content: b.content })),
      targetLanguage,
      lesson.language,
    );

    this.logger.log(`Lesson ${lessonId} translated to ${targetLanguage}`);
  }

  // ── Translate a game (title, description, level content) ──
  async translateGame(gameId: string, targetLanguage: string): Promise<void> {
    const game = await this.prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { levels: true },
    });

    const fields: Record<string, string> = {
      title: game.title,
    };
    if (game.description) fields['description'] = game.description;

    const job = await this.translationService.createTranslationJob(
      'game',
      gameId,
      targetLanguage,
      Object.keys(fields).length + game.levels.length,
    );

    await this.translateEntity(
      { entityType: 'game', entityId: gameId, fields },
      targetLanguage,
      job.id,
    );

    // Translate each game level content (JSON education content)
    for (const level of game.levels) {
      const contentStr = JSON.stringify(level.content);
      const prompt = `Translate all text values in this JSON game educational content from en to ${targetLanguage}.
Keep JSON structure, keys, and numbers exactly the same. Only translate string values.
Input: ${contentStr}`;
      try {
        const raw = await this.callGemini(prompt);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const translated = JSON.parse(jsonMatch[0]);
          await this.translationService.upsertLocalizedContent(
            'game_level',
            level.id,
            targetLanguage,
            'content',
            JSON.stringify(translated),
            true,
          );
        }
      } catch (err: any) {
        this.logger.error(`Game level translation failed: ${level.id}`, err);
      }
    }
  }

  // ── Translate a question ───────────────────────────────────
  async translateQuestion(questionId: string, targetLanguage: string): Promise<void> {
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
    });

    const fields: Record<string, string> = {
      body: question.body,
    };

    const job = await this.translationService.createTranslationJob(
      'question',
      questionId,
      targetLanguage,
      Object.keys(fields).length,
      question.language,
    );

    await this.translateEntity(
      { entityType: 'question', entityId: questionId, fields },
      targetLanguage,
      job.id,
      question.language,
    );

    // Translate options (JSON array)
    if (question.options) {
      const optStr = JSON.stringify(question.options);
      const prompt = `Translate the "text" fields in this JSON options array from ${question.language} to ${targetLanguage}.
Keep all other fields (id, imageUrl) unchanged.
Input: ${optStr}`;
      try {
        const raw = await this.callGemini(prompt);
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          await this.translationService.upsertLocalizedContent(
            'question',
            questionId,
            targetLanguage,
            'options',
            jsonMatch[0],
            true,
          );
        }
      } catch (err: any) {
        this.logger.error(`Question options translation failed: ${questionId}`, err);
      }
    }
  }

  // ── Translate UI namespace ─────────────────────────────────
  async translateUiNamespace(
    namespace: string,
    sourceMessages: Record<string, string>,
    targetLanguage: string,
  ): Promise<void> {
    const entries = Object.entries(sourceMessages);
    const prompt = `You are translating UI strings for an educational platform.
Translate from English to ${targetLanguage}.
Return ONLY valid JSON object with same keys, translated values.
Preserve {{variable}} placeholders exactly as-is.
Keep short and natural for UI context.

Input: ${JSON.stringify(sourceMessages)}`;

    const raw = await this.callGemini(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini did not return valid JSON for UI translations');
    }

    const translated: Record<string, string> = JSON.parse(jsonMatch[0]);
    await this.translationService.bulkUpsertTranslations(
      targetLanguage,
      namespace,
      translated,
    );
    this.logger.log(`Translated ${entries.length} UI strings to ${targetLanguage} [${namespace}]`);
  }
}
