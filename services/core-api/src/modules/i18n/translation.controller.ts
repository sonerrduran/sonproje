import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LanguageService } from './language.service';
import { TranslationService } from './translation.service';
import { TranslationJobData } from './translation.processor';

// ─── DTOs ─────────────────────────────────────────────────────

class UpsertTranslationDto {
  namespace: string = 'common';
  key!: string;
  value!: string;
}

class BulkTranslationDto {
  namespace: string = 'common';
  translations!: Record<string, string>;
}

class QueueTranslationDto {
  type!: 'lesson' | 'game' | 'question' | 'ui';
  entityId?: string;
  namespace?: string;
  messages?: Record<string, string>;
  targetLanguage!: string;
}

// ─── Controller ───────────────────────────────────────────────

@Controller('i18n')
export class TranslationController {
  constructor(
    private readonly languageService: LanguageService,
    private readonly translationService: TranslationService,
    @InjectQueue('translation') private readonly translationQueue: Queue<TranslationJobData>,
  ) {}

  // ── Languages ────────────────────────────────────────────

  /** GET /i18n/languages — list all supported languages */
  @Get('languages')
  async getLanguages(@Query('all') all?: string) {
    return this.languageService.findAll(all !== 'true');
  }

  /** GET /i18n/languages/:code — single language */
  @Get('languages/:code')
  async getLanguage(@Param('code') code: string) {
    return this.languageService.findOne(code);
  }

  /** PUT /i18n/languages/:code/default */
  @Put('languages/:code/default')
  async setDefault(@Param('code') code: string) {
    return this.languageService.setDefault(code);
  }

  /** PUT /i18n/languages/:code/activate */
  @Put('languages/:code/activate')
  async activate(@Param('code') code: string) {
    return this.languageService.activate(code);
  }

  /** DELETE /i18n/languages/:code/deactivate */
  @Delete('languages/:code/deactivate')
  async deactivate(@Param('code') code: string) {
    return this.languageService.deactivate(code);
  }

  // ── UI Translations ───────────────────────────────────────

  /** GET /i18n/translations/:lang — get all UI translations for a language */
  @Get('translations/:lang')
  async getTranslations(
    @Param('lang') lang: string,
    @Query('namespace') namespace = 'common',
  ) {
    return this.translationService.getTranslations(lang, namespace);
  }

  /** PUT /i18n/translations/:lang — upsert a single key */
  @Put('translations/:lang')
  async upsertTranslation(
    @Param('lang') lang: string,
    @Body() dto: UpsertTranslationDto,
  ) {
    return this.translationService.upsertTranslation(
      lang,
      dto.namespace,
      dto.key,
      dto.value,
    );
  }

  /** POST /i18n/translations/:lang/bulk — bulk upsert from JSON */
  @Post('translations/:lang/bulk')
  @HttpCode(HttpStatus.OK)
  async bulkUpsert(
    @Param('lang') lang: string,
    @Body() dto: BulkTranslationDto,
  ) {
    await this.translationService.bulkUpsertTranslations(
      lang,
      dto.namespace,
      dto.translations,
    );
    return { ok: true, count: Object.keys(dto.translations).length };
  }

  // ── Content Translations ──────────────────────────────────

  /** GET /i18n/content/:entityType/:entityId/:lang */
  @Get('content/:entityType/:entityId/:lang')
  async getLocalizedContent(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('lang') lang: string,
  ) {
    return this.translationService.getLocalizedContent(entityType, entityId, lang);
  }

  /** GET /i18n/jobs/:entityType/:entityId */
  @Get('jobs/:entityType/:entityId')
  async getTranslationJobs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.translationService.getTranslationJobs(entityType, entityId);
  }

  // ── AI Translation Queue ──────────────────────────────────

  /** POST /i18n/translate — queue an AI translation job */
  @Post('translate')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueTranslation(@Body() dto: QueueTranslationDto) {
    let jobData: TranslationJobData;

    switch (dto.type) {
      case 'lesson':
        jobData = { type: 'lesson', lessonId: dto.entityId!, targetLanguage: dto.targetLanguage };
        break;
      case 'game':
        jobData = { type: 'game', gameId: dto.entityId!, targetLanguage: dto.targetLanguage };
        break;
      case 'question':
        jobData = { type: 'question', questionId: dto.entityId!, targetLanguage: dto.targetLanguage };
        break;
      case 'ui':
        jobData = {
          type: 'ui',
          namespace: dto.namespace ?? 'common',
          messages: dto.messages ?? {},
          targetLanguage: dto.targetLanguage,
        };
        break;
    }

    const job = await this.translationQueue.add('translate', jobData!, {
      priority: dto.type === 'ui' ? 1 : 5, // UI translations are higher priority
    });

    return {
      accepted: true,
      jobId: job.id,
      type: dto.type,
      targetLanguage: dto.targetLanguage,
    };
  }
}
