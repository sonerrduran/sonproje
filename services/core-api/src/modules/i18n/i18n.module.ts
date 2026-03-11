import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { I18nService } from './i18n.service';
import { LanguageService } from './language.service';
import { TranslationService } from './translation.service';
import { AiTranslationService } from './ai-translation.service';
import { TranslationProcessor } from './translation.processor';
import { TranslationController } from './translation.controller';
import { LanguageDetectorMiddleware } from './language-detector.middleware';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'translation',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
  ],
  providers: [
    I18nService,
    LanguageService,
    TranslationService,
    AiTranslationService,
    TranslationProcessor,
  ],
  controllers: [TranslationController],
  exports: [I18nService, LanguageService, TranslationService],
})
export class I18nModule {}
