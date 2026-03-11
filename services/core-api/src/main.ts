import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createLoggerConfig } from './logger/logger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createLoggerConfig()),
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const isProduction = configService.get<string>('app.env') === 'production';

  // ─── Security ─────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: configService.get<string>('app.allowedOrigins')?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ─── API Versioning ───────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // ─── Global Pipes, Filters, Interceptors ──────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // Auto-transform DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ─── Swagger (disabled in production) ─────────────────────
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Education Platform API')
      .setDescription('Global SaaS Education Platform — Core API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('schools', 'School management')
      .addTag('users', 'User management')
      .addTag('classrooms', 'Classroom management')
      .addTag('lessons', 'Lesson system')
      .addTag('games', 'Game system')
      .addTag('analytics', 'Analytics and reporting')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ─── Graceful Shutdown ─────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  console.warn(`🚀 Core API running on port ${port} [${configService.get('app.env')}]`);
  if (!isProduction) {
    console.warn(`📖 Swagger docs → http://localhost:${port}/api/docs`);
  }
}

bootstrap();
