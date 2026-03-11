import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

const CACHE_TTL = 3600; // 1 hour

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── UI Translations ────────────────────────────────────────

  /** Load all translations for a language+namespace and return as flat record */
  async getTranslations(
    languageCode: string,
    namespace = 'common',
  ): Promise<Record<string, string>> {
    const cacheKey = `i18n:ui:${languageCode}:${namespace}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.translation.findMany({
      where: { languageCode, namespace },
      select: { key: true, value: true },
    });

    const result: Record<string, string> = {};
    for (const { key, value } of rows) {
      result[key] = value;
    }

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /** Upsert a single UI translation key */
  async upsertTranslation(
    languageCode: string,
    namespace: string,
    key: string,
    value: string,
  ) {
    const result = await this.prisma.translation.upsert({
      where: { languageCode_namespace_key: { languageCode, namespace, key } },
      create: { languageCode, namespace, key, value },
      update: { value },
    });
    await this.invalidateUiCache(languageCode, namespace);
    return result;
  }

  /** Bulk upsert from a JSON file (used during seeding) */
  async bulkUpsertTranslations(
    languageCode: string,
    namespace: string,
    translations: Record<string, string>,
  ) {
    const ops = Object.entries(translations).map(([key, value]) =>
      this.prisma.translation.upsert({
        where: { languageCode_namespace_key: { languageCode, namespace, key } },
        create: { languageCode, namespace, key, value },
        update: { value },
      }),
    );
    await this.prisma.$transaction(ops);
    await this.invalidateUiCache(languageCode, namespace);
    this.logger.log(`Upserted ${ops.length} translations for [${languageCode}/${namespace}]`);
  }

  // ── Content Translations (Lesson/Game/Question) ────────────

  async getLocalizedContent(
    entityType: string,
    entityId: string,
    languageCode: string,
  ): Promise<Record<string, string>> {
    const cacheKey = `i18n:content:${entityType}:${entityId}:${languageCode}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.localizedContent.findMany({
      where: { entityType, entityId, languageCode },
      select: { field: true, value: true },
    });

    const result: Record<string, string> = {};
    for (const { field, value } of rows) {
      result[field] = value;
    }

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async upsertLocalizedContent(
    entityType: string,
    entityId: string,
    languageCode: string,
    field: string,
    value: string,
    isAiGenerated = false,
  ) {
    const result = await this.prisma.localizedContent.upsert({
      where: {
        languageCode_entityType_entityId_field: {
          languageCode,
          entityType,
          entityId,
          field,
        },
      },
      create: { languageCode, entityType, entityId, field, value, isAiGenerated },
      update: { value, isAiGenerated },
    });
    await this.invalidateContentCache(entityType, entityId, languageCode);
    return result;
  }

  /** Get translated lesson content blocks */
  async getTranslatedBlocks(lessonId: string, languageCode: string) {
    return this.prisma.contentTranslation.findMany({
      where: { languageCode },
      select: { blockId: true, content: true, isAiGenerated: true },
    });
  }

  /** Store translated block content */
  async upsertBlockTranslation(
    blockId: string,
    languageCode: string,
    content: string,
    isAiGenerated = false,
  ) {
    return this.prisma.contentTranslation.upsert({
      where: { blockId_languageCode: { blockId, languageCode } },
      create: { blockId, languageCode, content, isAiGenerated },
      update: { content, isAiGenerated },
    });
  }

  // ── Translation Jobs ───────────────────────────────────────

  async createTranslationJob(
    entityType: string,
    entityId: string,
    targetLangCode: string,
    fieldsTotal: number,
    sourceLang = 'en',
  ) {
    return this.prisma.translationJob.create({
      data: {
        entityType,
        entityId,
        sourceLang,
        targetLangCode,
        fieldsTotal,
        status: 'PENDING',
      },
    });
  }

  async updateTranslationJob(
    jobId: string,
    update: {
      status?: string;
      fieldsDone?: number;
      tokensUsed?: number;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    },
  ) {
    return this.prisma.translationJob.update({
      where: { id: jobId },
      data: update as any,
    });
  }

  async getTranslationJobs(entityType: string, entityId: string) {
    return this.prisma.translationJob.findMany({
      where: { entityType, entityId },
      include: { targetLanguage: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Cache Invalidation ────────────────────────────────────

  private async invalidateUiCache(languageCode: string, namespace: string) {
    await this.redis.del(`i18n:ui:${languageCode}:${namespace}`);
  }

  private async invalidateContentCache(
    entityType: string,
    entityId: string,
    languageCode: string,
  ) {
    await this.redis.del(`i18n:content:${entityType}:${entityId}:${languageCode}`);
  }
}
