import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Services
import { PromptBuilderService } from './prompt-builder.service';
import { AiCostControlService } from './ai-cost-control.service';
import { AiGameContentService } from './ai-game-content.service';
import { AiContentService } from './ai-content.service';

// Processor
import { AiProcessor } from './ai.processor';

// Controller
import { AiController } from './ai.controller';

/**
 * AI Content Factory Module
 *
 * APIs at /api/v1/ai:
 *  POST /ai/generate/lesson        → async BullMQ job (Gemini)
 *  POST /ai/generate/questions     → immediate + 24h cache
 *  POST /ai/generate/explanation   → immediate + cache
 *  POST /ai/generate/summary       → immediate + cache
 *  POST /ai/generate/game-content  → immediate by template type
 *  GET  /ai/jobs/:id               → job status
 *  GET  /ai/jobs                   → job history
 *  GET  /ai/usage                  → rate limits + cache hit rate
 *
 * BullMQ queue: 'ai-generation' (shared with LessonsModule)
 *
 * Cost controls:
 *  - 10 req/min per school (configurable)
 *  - 200 req/day per school
 *  - 100 req/min global
 *  - 24h Redis cache by SHA-256 of prompt context
 *  - 7-day deduplication check
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-generation' }),
  ],
  controllers: [AiController],
  providers: [
    PromptBuilderService,
    AiCostControlService,
    AiGameContentService,
    AiContentService,
    AiProcessor,
  ],
  exports: [
    AiContentService,
    PromptBuilderService,
    AiGameContentService,
  ],
})
export class AiModule {}
