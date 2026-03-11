import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @ApiOperation({ summary: 'List classrooms in the current school' })
  @ApiQuery({ name: 'archived', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('archived') archived?: boolean,
  ) {
    return this.classroomsService.findAll(schoolId, { page, limit, archived });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get classroom details with students and teachers' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.classroomsService.findById(id, schoolId);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new classroom' })
  create(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() data: { name: string; section?: string; gradeLevelId?: string; academicYearId?: string },
  ) {
    return this.classroomsService.create(schoolId, teacherId, data);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update classroom name or section' })
  update(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() data: { name?: string; section?: string },
  ) {
    return this.classroomsService.update(id, schoolId, data);
  }

  @Patch(':id/archive')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a classroom' })
  archive(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.classroomsService.archive(id, schoolId);
  }

  @Patch(':id/restore')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived classroom' })
  restore(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.classroomsService.restore(id, schoolId);
  }
}
