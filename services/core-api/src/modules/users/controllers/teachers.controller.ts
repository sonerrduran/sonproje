import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from '../users.service';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all teachers in the school' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll(schoolId, { role: UserRole.TEACHER, search, page, limit });
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get teacher profile' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.findById(id, schoolId);
  }

  @Get(':id/classrooms')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Get teacher's assigned classrooms" })
  getClassrooms(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.getTeacherClassrooms(id, schoolId);
  }

  @Post()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new teacher account' })
  create(
    @CurrentSchool() schoolId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(schoolId, { ...dto, role: UserRole.TEACHER });
  }

  @Patch(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update teacher profile' })
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
  @ApiOperation({ summary: 'Activate or suspend a teacher' })
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
  @ApiOperation({ summary: 'Deactivate a teacher account' })
  remove(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') requestingUserId: string,
  ) {
    return this.usersService.remove(id, schoolId, requestingUserId);
  }
}
