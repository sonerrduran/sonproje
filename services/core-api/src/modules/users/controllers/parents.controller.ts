import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dto/user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('parents')
export class ParentsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all parent accounts in the school' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll(schoolId, { role: UserRole.PARENT, search, page, limit });
  }

  @Get('me/children')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Get current parent\'s linked students' })
  getMyChildren(
    @CurrentUser('id') parentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.usersService.getParentChildren(parentId, schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get parent profile' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.usersService.findById(id, schoolId);
  }

  @Get(':id/children')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get students linked to a parent' })
  getChildren(@Param('id') parentId: string, @CurrentSchool() schoolId: string) {
    return this.usersService.getParentChildren(parentId, schoolId);
  }

  @Post()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a parent account' })
  create(@CurrentSchool() schoolId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(schoolId, { ...dto, role: UserRole.PARENT });
  }

  @Delete(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a parent account' })
  remove(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') requestingUserId: string,
  ) {
    return this.usersService.remove(id, schoolId, requestingUserId);
  }
}
