import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Services
import { AnalyticsService } from './analytics.service';
import { LearningIntelligenceService } from './learning-intelligence.service';
import { StudentDashboardService } from './student-dashboard.service';
import { TeacherDashboardService } from './teacher-dashboard.service';

// Processor
import { AnalyticsProcessor } from './analytics.processor';

// Controller
import { AnalyticsController } from './analytics.controller';

// Cross-module service imports
import { GamesModule } from '../games/games.module';

/**
 * Analytics Module — Platform-wide Learning Analytics
 *
 * APIs at /api/v1/analytics:
 *  GET /analytics/school                    → school-wide KPIs
 *  GET /analytics/school/lessons            → lesson analytics
 *  GET /analytics/school/games              → game analytics
 *  GET /analytics/classroom/:id             → class dashboard (completion, at-risk, top)
 *  GET /analytics/classroom/:id/students    → student comparison table
 *  GET /analytics/classroom/:id/weak-topics → aggregate class weak spots
 *  GET /analytics/me                        → student self-dashboard
 *  GET /analytics/me/progress               → detailed lesson/game/practice history
 *  GET /analytics/me/weekly                 → 7-day activity chart
 *  GET /analytics/me/recommendations        → AI-ranked learning recommendations
 *  GET /analytics/me/streak                 → learning streak
 *  GET /analytics/students/:id              → admin view of any student
 *  GET /analytics/students/:id/weak-topics  → weak topics
 *  GET /analytics/students/:id/strong-topics→ strong topics
 *  GET /analytics/students/:id/streak       → student streak
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'analytics' }),
    GamesModule, // for GamificationService
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    LearningIntelligenceService,
    StudentDashboardService,
    TeacherDashboardService,
    AnalyticsProcessor,
  ],
  exports: [AnalyticsService, LearningIntelligenceService, StudentDashboardService],
})
export class AnalyticsModule {}
