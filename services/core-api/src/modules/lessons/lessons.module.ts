import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Services
import { LessonsService } from './lessons.service';
import { LessonContentService } from './lesson-content.service';
import { QuestionsService } from './questions.service';
import { PracticeService } from './practice.service';
import { AiLessonService } from './ai-lesson.service';
import { LessonAnalyticsService } from './lesson-analytics.service';

// Processors
import { AiLessonProcessor } from './ai-lesson.processor';

// Controllers
import { LessonsController } from './lessons.controller';
import { LessonContentController } from './controllers/lesson-content.controller';
import { QuestionsController } from './controllers/questions.controller';
import { PracticeController } from './controllers/practice.controller';
import { LessonAiAnalyticsController } from './controllers/lesson-ai-analytics.controller';

/**
 * Lessons Module — Complete Lesson System
 *
 * APIs:
 *   /api/v1/lessons          → CRUD + assign + progress (LessonsController)
 *   /api/v1/lessons/generate → AI generation queue (LessonAiAnalyticsController)
 *   /api/v1/lessons/analytics → Dashboard + student reports
 *   /api/v1/lessons/:id/content → Content blocks CRUD
 *   /api/v1/questions        → Question bank CRUD
 *   /api/v1/practice         → Practice sets + attempts
 *
 * Background jobs:
 *   BullMQ queue: 'ai-generation' → AiLessonProcessor
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-generation' }),
  ],
  controllers: [
    LessonsController,
    LessonContentController,
    LessonAiAnalyticsController,
    QuestionsController,
    PracticeController,
  ],
  providers: [
    LessonsService,
    LessonContentService,
    QuestionsService,
    PracticeService,
    AiLessonService,
    AiLessonProcessor,
    LessonAnalyticsService,
  ],
  exports: [LessonsService, QuestionsService, PracticeService, LessonAnalyticsService],
})
export class LessonsModule {}
