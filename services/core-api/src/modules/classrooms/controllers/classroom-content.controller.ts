import {
  Controller, Get, Post, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ClassroomsService } from './classrooms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('classrooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('classrooms/:id')
export class ClassroomContentController {
  constructor(private readonly service: ClassroomsService) {}

  // ─── Lessons ──────────────────────────────────────────────

  @Get('lessons')
  @ApiOperation({ summary: 'List lessons assigned to this classroom with completion rates' })
  listLessons(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.listAssignedLessons(id, schoolId);
  }

  @Post('lessons')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a published lesson to this classroom' })
  assignLesson(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() body: { lessonId: string; dueDate?: string },
  ) {
    return this.service.assignLesson(classroomId, schoolId, teacherId, body);
  }

  @Delete('lessons/:assignmentId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a lesson assignment from this classroom' })
  removeLesson(
    @Param('id') classroomId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.removeAssignedLesson(assignmentId, classroomId, schoolId);
  }

  // ─── Games ────────────────────────────────────────────────

  @Get('games')
  @ApiOperation({ summary: 'List games assigned to this classroom' })
  listGames(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.listAssignedGames(id, schoolId);
  }

  @Post('games')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a game to this classroom' })
  assignGame(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() body: { gameId: string; minLevel?: number; dueDate?: string },
  ) {
    return this.service.assignGame(classroomId, schoolId, teacherId, body);
  }

  @Delete('games/:assignmentId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a game assignment from this classroom' })
  removeGame(
    @Param('id') classroomId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.removeAssignedGame(assignmentId, classroomId, schoolId);
  }
}
