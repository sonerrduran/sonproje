import {
  Controller, Get, Post,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PracticeService } from '../practice.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('practice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('practice')
export class PracticeController {
  constructor(private readonly service: PracticeService) {}

  // ─── Sets ─────────────────────────────────────────────────

  @Get('sets')
  @ApiOperation({ summary: 'List practice sets in the school' })
  listSets(
    @CurrentSchool() schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listSets(schoolId, { page, limit });
  }

  @Get('sets/:id')
  @ApiOperation({ summary: 'Get a practice set with all questions' })
  getSet(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.findSet(id, schoolId);
  }

  @Post('sets')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create a new practice set' })
  createSet(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() body: {
      title: string;
      questionIds: string[];
      config?: { timed?: boolean; timeLimit?: number; shuffle?: boolean; maxAttempts?: number };
    },
  ) {
    return this.service.createSet(schoolId, teacherId, body);
  }

  // ─── Lesson Quick-Practice ────────────────────────────────

  @Get('lesson/:lessonId')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get shuffled practice questions from a lesson (no answers revealed)' })
  getLessonPractice(
    @Param('lessonId') lessonId: string,
    @CurrentSchool() schoolId: string,
    @Query('count') count?: number,
  ) {
    return this.service.getLessonPractice(lessonId, schoolId, count ?? 10);
  }

  // ─── Attempts ─────────────────────────────────────────────

  @Post('sets/:id/start')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Start a practice attempt (returns attemptId)' })
  startAttempt(
    @Param('id') setId: string,
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.startAttempt(setId, studentId, schoolId);
  }

  @Post('attempts/:attemptId/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit answers — auto-graded, XP awarded' })
  submitAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
    @Body('answers') answers: Array<{ questionId: string; answer: string | string[]; timeMs?: number }>,
  ) {
    return this.service.submitAttempt(attemptId, studentId, schoolId, answers);
  }

  @Get('history')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get current student\'s attempt history' })
  getHistory(
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
    @Query('setId') setId?: string,
  ) {
    return this.service.getAttemptHistory(studentId, schoolId, setId);
  }
}
