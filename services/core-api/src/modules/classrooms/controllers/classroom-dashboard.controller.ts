import {
  Controller, Get, Post,
  Param, Body, UseGuards,
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
export class ClassroomDashboardController {
  constructor(private readonly service: ClassroomsService) {}

  @Get('dashboard')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get classroom dashboard — student count, lesson completion, game sessions, top XP earners',
  })
  getDashboard(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.getDashboard(id, schoolId);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'List latest announcements for this classroom' })
  listAnnouncements(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.listAnnouncements(id, schoolId);
  }

  @Post('announcements')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Post an announcement to this classroom' })
  createAnnouncement(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() body: { title: string; body: string },
  ) {
    return this.service.createAnnouncement(classroomId, schoolId, teacherId, body);
  }
}
