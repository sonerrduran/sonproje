import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from '../users.service';
import { CreateUserDto, UpdateUserDto, LinkParentDto } from '../dto/user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List all students in the school' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll(schoolId, { role: UserRole.STUDENT, search, page, limit });
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get student profile' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.findById(id, schoolId);
  }

  @Get(':id/stats')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: 'Get student learning stats (XP, level, lessons, games)' })
  getStats(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.getStudentStats(id, schoolId);
  }

  @Get(':id/classrooms')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get classrooms this student is enrolled in' })
  getClassrooms(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.getStudentClassrooms(id, schoolId);
  }

  @Post()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new student account' })
  create(@CurrentSchool() schoolId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(schoolId, { ...dto, role: UserRole.STUDENT });
  }

  @Post(':id/link-parent')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a parent account to this student' })
  linkParent(
    @Param('id') studentId: string,
    @CurrentSchool() schoolId: string,
    @Body() dto: LinkParentDto,
  ) {
    return this.usersService.linkParentToStudent(dto.parentId, studentId, schoolId);
  }

  @Delete(':id/unlink-parent/:parentId')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove parent-student link' })
  unlinkParent(
    @Param('id') studentId: string,
    @Param('parentId') parentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.usersService.unlinkParentFromStudent(parentId, studentId, schoolId);
  }

  @Patch(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update student profile' })
  update(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, schoolId, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or suspend a student' })
  updateStatus(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body('status') status: UserStatus,
  ) {
    return this.usersService.updateStatus(id, schoolId, status);
  }

  @Delete(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a student account' })
  remove(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') requestingUserId: string,
  ) {
    return this.usersService.remove(id, schoolId, requestingUserId);
  }
}
