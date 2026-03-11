import {
  Controller, Get, Post,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GamificationService } from '../gamification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // ─── My XP & Level ───────────────────────────────────────

  @Get('me/xp')
  @ApiOperation({ summary: 'Get current user XP, level, and progress to next level' })
  getMyXp(@CurrentUser('id') userId: string) {
    return this.gamificationService.getXpSummary(userId);
  }

  @Get('me/xp/history')
  @ApiOperation({ summary: 'Recent XP events for current user' })
  getMyXpHistory(@CurrentUser('id') userId: string) {
    return this.gamificationService.getXpHistory(userId);
  }

  @Get('me/badges')
  @ApiOperation({ summary: 'Badges/achievements earned by current user' })
  getMyBadges(@CurrentUser('id') userId: string) {
    return this.gamificationService.getUserBadges(userId);
  }

  // ─── Other student stats (teacher/admin) ─────────────────

  @Get('students/:id/xp')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "Get a student's XP and level" })
  getStudentXp(@Param('id') userId: string) {
    return this.gamificationService.getXpSummary(userId);
  }

  @Get('students/:id/badges')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "Get a student's earned badges" })
  getStudentBadges(@Param('id') userId: string) {
    return this.gamificationService.getUserBadges(userId);
  }

  // ─── Leaderboards ─────────────────────────────────────────

  @Get('leaderboard/school')
  @ApiOperation({ summary: 'School-wide XP leaderboard (top 10, Redis cached 5 min)' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  schoolLeaderboard(
    @CurrentSchool() schoolId: string,
    @Query('limit') limit?: number,
  ) {
    return this.gamificationService.getSchoolLeaderboard(schoolId, limit);
  }

  @Get('leaderboard/classroom/:id')
  @ApiOperation({ summary: 'Classroom XP leaderboard' })
  classroomLeaderboard(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
    @Query('limit') limit?: number,
  ) {
    return this.gamificationService.getClassroomLeaderboard(classroomId, schoolId, limit);
  }

  // ─── Manual XP award (admin only) ────────────────────────

  @Post('students/:id/xp')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually award XP to a student (admin bonus)' })
  awardXp(
    @Param('id') userId: string,
    @CurrentSchool() schoolId: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.gamificationService.addXp(userId, schoolId, body.amount, body.reason);
  }
}
