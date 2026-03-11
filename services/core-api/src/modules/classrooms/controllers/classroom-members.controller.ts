import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ClassroomsService } from './classrooms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('classrooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('classrooms/:id')
export class ClassroomMembersController {
  constructor(private readonly service: ClassroomsService) {}

  // ─── Students ─────────────────────────────────────────────

  @Get('students')
  @ApiOperation({ summary: 'List students enrolled in this classroom' })
  listStudents(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.listStudents(id, schoolId);
  }

  @Post('students')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enroll a student in this classroom' })
  addStudent(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @Body('studentId') studentId: string,
  ) {
    return this.service.addStudent(classroomId, studentId, schoolId);
  }

  @Post('students/bulk')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk enroll multiple students at once' })
  bulkAddStudents(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @Body('studentIds') studentIds: string[],
  ) {
    return this.service.bulkAddStudents(classroomId, studentIds, schoolId);
  }

  @Delete('students/:studentId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a student from this classroom' })
  removeStudent(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.removeStudent(classroomId, studentId, schoolId);
  }

  // ─── Teachers ─────────────────────────────────────────────

  @Get('teachers')
  @ApiOperation({ summary: 'List teachers assigned to this classroom' })
  listTeachers(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.listTeachers(id, schoolId);
  }

  @Post('teachers')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a teacher to this classroom' })
  addTeacher(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @Body() body: { teacherId: string; isPrimary?: boolean },
  ) {
    return this.service.addTeacher(classroomId, body.teacherId, schoolId, body.isPrimary);
  }

  @Patch('teachers/:teacherId/primary')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a teacher as the primary teacher of this classroom' })
  setPrimary(
    @Param('id') classroomId: string,
    @Param('teacherId') teacherId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.setPrimaryTeacher(classroomId, teacherId, schoolId);
  }

  @Delete('teachers/:teacherId')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a teacher from this classroom' })
  removeTeacher(
    @Param('id') classroomId: string,
    @Param('teacherId') teacherId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.removeTeacher(classroomId, teacherId, schoolId);
  }
}
