import {
  Controller, Get, Post, Patch, Param, Body,
  Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiOperation({ summary: 'List lessons in current school' })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('status') status?: string,
    @Query('subject') subject?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.lessonsService.findAll(schoolId, { status, subject, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson with content blocks' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.lessonsService.findById(id, schoolId);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create a new lesson manually' })
  create(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() data: { title: string; subject?: string; gradeLevel?: string; language?: string; tags?: string[] },
  ) {
    return this.lessonsService.create(schoolId, teacherId, data);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update lesson details' })
  update(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.lessonsService.update(id, schoolId, data);
  }

  @Post(':id/publish')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Publish a draft lesson' })
  publish(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.lessonsService.publish(id, schoolId);
  }

  @Post('generate')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Request AI lesson generation via Gemini API' })
  generateWithAI(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() data: { topic: string; subject: string; gradeLevel: string; language: string; objectives?: string[] },
  ) {
    return this.lessonsService.generateWithAI(schoolId, teacherId, data);
  }

  @Post(':id/assign')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Assign a published lesson to classrooms or individual students' })
  assign(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() data: { classroomIds?: string[]; studentIds?: string[]; dueDate?: string },
  ) {
    return this.lessonsService.assign(id, schoolId, teacherId, data);
  }

  @Post(':id/progress')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Save lesson progress for the current student' })
  saveProgress(
    @Param('id') lessonId: string,
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
    @Body('progressPct') progressPct: number,
  ) {
    return this.lessonsService.markProgress(lessonId, studentId, schoolId, progressPct);
  }
}
