import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { LanguageService } from './language.service';

/**
 * I18nService — thin facade that components use directly.
 * Provides t() function (like next-intl but server-side).
 */
@Injectable()
export class I18nService {
  private cache = new Map<string, Record<string, string>>();

  constructor(
    private readonly translationService: TranslationService,
    private readonly languageService: LanguageService,
  ) {}

  /** Translate a UI key for a given language. Falls back to English. */
  async t(
    key: string,
    languageCode: string,
    namespace = 'common',
    params?: Record<string, string | number>,
  ): Promise<string> {
    const cacheKey = `${languageCode}:${namespace}`;
    if (!this.cache.has(cacheKey)) {
      const translations = await this.translationService.getTranslations(
        languageCode,
        namespace,
      );
      this.cache.set(cacheKey, translations);
    }

    let value = this.cache.get(cacheKey)?.[key];

    // Fall back to English
    if (!value && languageCode !== 'en') {
      const enKey = `en:${namespace}`;
      if (!this.cache.has(enKey)) {
        const en = await this.translationService.getTranslations('en', namespace);
        this.cache.set(enKey, en);
      }
      value = this.cache.get(enKey)?.[key];
    }

    if (!value) return key; // Last resort: return the key itself

    // Interpolate {{variable}} placeholders
    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramVal));
      }
    }

    return value;
  }

  /** Detect language from request headers */
  detectLanguage(acceptLanguageHeader?: string): string {
    return this.languageService.detectFromAcceptLanguage(acceptLanguageHeader);
  }

  /** Get localized content for an entity (lesson/game) */
  async getLocalizedEntity<T extends Record<string, any>>(
    entity: T,
    entityType: string,
    languageCode: string,
    localizedFields: (keyof T)[],
  ): Promise<T> {
    if (languageCode === 'en') return entity; // English is the source

    const localized = await this.translationService.getLocalizedContent(
      entityType,
      (entity as any).id,
      languageCode,
    );

    if (Object.keys(localized).length === 0) return entity; // No translation available

    const result = { ...entity };
    for (const field of localizedFields) {
      const fieldStr = field as string;
      if (localized[fieldStr]) {
        (result as any)[fieldStr] = localized[fieldStr];
      }
    }
    return result;
  }
}
