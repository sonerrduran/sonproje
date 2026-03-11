import {
  Controller, Get, Post,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AiContentService } from './ai-content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiContentService) {}

  // ─── Generate endpoints ────────────────────────────────────

  @Post('generate/lesson')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Queue an AI lesson generation job (async, Gemini 2.0 Flash)' })
  generateLesson(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      subject: string; topic: string; gradeLevel: string;
      language?: string; difficulty?: 'easy' | 'medium' | 'hard';
      questionCount?: number; objectives?: string[];
    },
  ) {
    return this.aiService.generate({
      schoolId, userId, type: 'lesson', ctx: body, async: true,
    });
  }

  @Post('generate/questions')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Generate practice questions immediately (Gemini, cached 24h)' })
  generateQuestions(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      subject: string; topic: string; gradeLevel: string;
      questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard'; language?: string;
    },
  ) {
    return this.aiService.generate({ schoolId, userId, type: 'questions', ctx: body });
  }

  @Post('generate/explanation')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get an AI explanation of a topic (immediate, cached)' })
  generateExplanation(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { subject: string; topic: string; gradeLevel: string; language?: string },
  ) {
    return this.aiService.generate({ schoolId, userId, type: 'explanation', ctx: body });
  }

  @Post('generate/summary')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Generate a study summary for a topic (immediate, cached)' })
  generateSummary(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { subject: string; topic: string; gradeLevel: string; language?: string },
  ) {
    return this.aiService.generate({ schoolId, userId, type: 'summary', ctx: body });
  }

  @Post('generate/game-content')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Generate content for a game level (by template type)' })
  generateGameContent(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      templateId: string; subject: string; topic: string; gradeLevel: string;
      levelNum?: number; difficulty?: 'easy' | 'medium' | 'hard';
      language?: string; questionCount?: number; pairCount?: number;
      levelCount?: number;
    },
  ) {
    const { templateId, levelCount, ...ctx } = body;
    return this.aiService.generate({
      schoolId, userId, type: 'game-content', ctx, templateId, levelCount,
    });
  }

  // ─── Job tracking ─────────────────────────────────────────

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Check the status of an async AI generation job' })
  getJob(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.aiService.getJobStatus(id, schoolId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'View AI generation history for this school' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getHistory(@CurrentSchool() schoolId: string, @Query('limit') limit?: number) {
    return this.aiService.getJobHistory(schoolId, limit);
  }

  // ─── Usage & Cost ─────────────────────────────────────────

  @Get('usage')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'AI usage stats: requests today, rate limits, cache hit rate' })
  getUsage(@CurrentSchool() schoolId: string) {
    return this.aiService.getUsageSummary(schoolId);
  }
}
