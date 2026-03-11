import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { jwtConfig } from './config/jwt.config';
import { aiConfig } from './config/ai.config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { GamesModule } from './modules/games/games.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { I18nModule } from './modules/i18n/i18n.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ─── Config (global) ──────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, aiConfig],
      validationOptions: { abortEarly: true },
    }),

    // ─── Database ─────────────────────────────────────────────
    DatabaseModule,

    // ─── Cache ────────────────────────────────────────────────
    RedisModule,

    // ─── Job Queues ───────────────────────────────────────────
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      }),
    }),

    // ─── Feature Modules ──────────────────────────────────────
    AuthModule,
    UsersModule,
    SchoolsModule,
    ClassroomsModule,
    LessonsModule,
    GamesModule,
    AnalyticsModule,

    // ─── Internationalization (global) ────────────────────────
    I18nModule,

    // ─── Health checks ────────────────────────────────────────
    HealthModule,
  ],
})
export class AppModule {}
