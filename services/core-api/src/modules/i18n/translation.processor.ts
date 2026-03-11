import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiTranslationService } from './ai-translation.service';

export type TranslationJobData =
  | { type: 'lesson';    lessonId: string;   targetLanguage: string }
  | { type: 'game';      gameId: string;     targetLanguage: string }
  | { type: 'question';  questionId: string; targetLanguage: string }
  | { type: 'ui';        namespace: string;  messages: Record<string, string>; targetLanguage: string };

@Processor('translation')
export class TranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(TranslationProcessor.name);

  constructor(private readonly aiTranslation: AiTranslationService) {
    super();
  }

  async process(job: Job<TranslationJobData>): Promise<void> {
    this.logger.log(`Processing translation job ${job.id}: ${job.data.type}`);

    try {
      switch (job.data.type) {
        case 'lesson':
          await this.aiTranslation.translateLesson(
            job.data.lessonId,
            job.data.targetLanguage,
          );
          break;

        case 'game':
          await this.aiTranslation.translateGame(
            job.data.gameId,
            job.data.targetLanguage,
          );
          break;

        case 'question':
          await this.aiTranslation.translateQuestion(
            job.data.questionId,
            job.data.targetLanguage,
          );
          break;

        case 'ui':
          await this.aiTranslation.translateUiNamespace(
            job.data.namespace,
            job.data.messages,
            job.data.targetLanguage,
          );
          break;

        default:
          this.logger.warn(`Unknown translation job type`);
      }

      this.logger.log(`Translation job ${job.id} completed`);
    } catch (err: any) {
      this.logger.error(`Translation job ${job.id} failed`, err);
      throw err; // BullMQ will retry
    }
  }
}
