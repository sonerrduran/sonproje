import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
}

// ─── Default supported languages ──────────────────────────────
const DEFAULT_LANGUAGES: Omit<SupportedLanguage, 'isDefault'>[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    direction: 'ltr' },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',     direction: 'ltr' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    direction: 'ltr' },
  { code: 'fr', name: 'French',     nativeName: 'Français',   direction: 'ltr' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    direction: 'ltr' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',    direction: 'rtl' },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',        direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  direction: 'ltr' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    direction: 'ltr' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       direction: 'ltr' },
];

@Injectable()
export class LanguageService implements OnModuleInit {
  private readonly logger = new Logger(LanguageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Seed default languages on startup ─────────────────────
  async onModuleInit() {
    await this.seedDefaultLanguages();
  }

  private async seedDefaultLanguages() {
    for (const lang of DEFAULT_LANGUAGES) {
      await this.prisma.language.upsert({
        where: { code: lang.code },
        create: {
          ...lang,
          isDefault: lang.code === 'en',
          isActive: true,
        },
        update: { name: lang.name, nativeName: lang.nativeName },
      });
    }
    this.logger.log(`Seeded ${DEFAULT_LANGUAGES.length} languages`);
  }

  // ── CRUD ──────────────────────────────────────────────────
  async findAll(activeOnly = true) {
    return this.prisma.language.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(code: string) {
    return this.prisma.language.findUnique({ where: { code } });
  }

  async activate(code: string) {
    return this.prisma.language.update({
      where: { code },
      data: { isActive: true },
    });
  }

  async deactivate(code: string) {
    return this.prisma.language.update({
      where: { code },
      data: { isActive: false },
    });
  }

  async setDefault(code: string) {
    // Remove existing default
    await this.prisma.language.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.language.update({
      where: { code },
      data: { isDefault: true, isActive: true },
    });
  }

  // ── Language Detection ─────────────────────────────────────
  detectFromAcceptLanguage(header: string | undefined): string {
    if (!header) return 'en';

    // Parse Accept-Language header: "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
    const langs = header
      .split(',')
      .map((part) => {
        const [langTag, q] = part.trim().split(';q=');
        return {
          code: langTag.trim().split('-')[0].toLowerCase(), // "tr-TR" → "tr"
          quality: q ? parseFloat(q) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    const supported = DEFAULT_LANGUAGES.map((l) => l.code);
    for (const { code } of langs) {
      if (supported.includes(code)) return code;
    }
    return 'en';
  }

  detectFromText(text: string): string {
    // Simple heuristic — detect Arabic/CJK/Cyrillic scripts
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'zh';
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    return 'en'; // Default fallback
  }
}
