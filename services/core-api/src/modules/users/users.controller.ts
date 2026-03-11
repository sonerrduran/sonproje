import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── General user list (admin view) ───────────────────────

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users in school (any role)' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll(schoolId, { role, status, search, page, limit });
  }

  @Get('counts')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user counts by role (for dashboard)' })
  getCounts(@CurrentSchool() schoolId: string) {
    return this.usersService.getRoleCounts(schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get any user by ID' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.findById(id, schoolId);
  }

  @Post()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a user (any role) — admin only' })
  create(@CurrentSchool() schoolId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(schoolId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
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
  @ApiOperation({ summary: 'Activate or suspend a user' })
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
  @ApiOperation({ summary: 'Deactivate a user account (soft delete)' })
  remove(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') requestingUserId: string,
  ) {
    return this.usersService.remove(id, schoolId, requestingUserId);
  }
}
