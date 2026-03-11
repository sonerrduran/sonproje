import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LessonsService } from '../lessons.service';
import { AiLessonService } from '../ai-lesson.service';
import { LessonAnalyticsService } from '../lesson-analytics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons')
export class LessonAiAnalyticsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly aiService: AiLessonService,
    private readonly analyticsService: LessonAnalyticsService,
  ) {}

  // ─── AI Generation ────────────────────────────────────────

  @Post('generate')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Queue an AI lesson generation job (Gemini 2.0)' })
  generateLesson(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() body: {
      topic: string; subject: string; gradeLevel: string;
      language?: string; objectives?: string[];
      questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard';
    },
  ) {
    return this.lessonsService.generateWithAI(schoolId, teacherId, body);
  }

  @Post('generate/questions')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Generate questions only (immediate, not queued)' })
  async generateQuestions(
    @Body() body: {
      topic: string; subject: string; gradeLevel: string;
      count?: number; language?: string; difficulty?: string;
    },
  ) {
    return this.aiService.generateQuestions(body);
  }

  // ─── Analytics ────────────────────────────────────────────

  @Get('analytics/school')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'School lesson dashboard: total lessons, AI-generated, practice stats' })
  schoolDashboard(@CurrentSchool() schoolId: string) {
    return this.analyticsService.getSchoolLessonDashboard(schoolId);
  }

  @Get('analytics/subjects')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Lesson count by subject' })
  subjectBreakdown(@CurrentSchool() schoolId: string) {
    return this.analyticsService.getSubjectBreakdown(schoolId);
  }

  @Get('analytics/student/:studentId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Student lesson report: progress, practice scores, weak areas' })
  studentReport(@Param('studentId') studentId: string, @CurrentSchool() schoolId: string) {
    return this.analyticsService.getStudentLessonReport(studentId, schoolId);
  }

  @Get(':id/analytics')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Per-lesson stats: completion rate, avg progress' })
  lessonStats(@Param('id') lessonId: string, @CurrentSchool() schoolId: string) {
    return this.analyticsService.getLessonStats(lessonId, schoolId);
  }
}
