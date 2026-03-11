import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { StudentDashboardService } from './student-dashboard.service';
import { TeacherDashboardService } from './teacher-dashboard.service';
import { LearningIntelligenceService } from './learning-intelligence.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly studentDashboard: StudentDashboardService,
    private readonly teacherDashboard: TeacherDashboardService,
    private readonly intelligence: LearningIntelligenceService,
  ) {}

  // ─── School-level (admin) ─────────────────────────────────

  @Get('school')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'School-wide analytics dashboard' })
  schoolDashboard(@CurrentSchool() schoolId: string) {
    return this.analytics.getSchoolDashboard(schoolId);
  }

  @Get('school/lessons')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Lesson analytics — completion rates, avg progress' })
  lessonAnalytics(@CurrentSchool() schoolId: string) {
    return this.teacherDashboard.getLessonAnalytics(schoolId);
  }

  @Get('school/games')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Game analytics — plays, avg score, completion rates' })
  gameAnalytics(@CurrentSchool() schoolId: string) {
    return this.teacherDashboard.getGameAnalytics(schoolId);
  }

  // ─── Teacher / Classroom ──────────────────────────────────

  @Get('classroom/:id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Classroom analytics: lesson/game/practice completion, top/at-risk students' })
  classroomDashboard(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.teacherDashboard.getClassDashboard(classroomId, schoolId);
  }

  @Get('classroom/:id/students')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Student comparison table: XP, lessons, games, last active' })
  studentComparison(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.teacherDashboard.getStudentComparison(classroomId, schoolId);
  }

  @Get('classroom/:id/weak-topics')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Aggregate weak topics for a classroom' })
  classWeakTopics(
    @Param('id') classroomId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.teacherDashboard.getClassWeakTopics(classroomId, schoolId);
  }

  // ─── Student dashboard (self) ─────────────────────────────

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student dashboard: XP, lessons, games, badges, recommendations' })
  myDashboard(
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.studentDashboard.getDashboard(studentId, schoolId);
  }

  @Get('me/progress')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student detailed progress: lesson + game + practice history' })
  myProgress(
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.studentDashboard.getDetailedProgress(studentId, schoolId);
  }

  @Get('me/weekly')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '7-day activity chart: lessons/games/practice per day' })
  myWeekly(@CurrentUser('id') studentId: string) {
    return this.studentDashboard.getWeeklyActivity(studentId);
  }

  @Get('me/recommendations')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Personalized learning recommendations (urgency ranked)' })
  myRecommendations(
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.intelligence.getRecommendations(studentId, schoolId);
  }

  @Get('me/streak')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Current + longest learning streak, active dates' })
  myStreak(@CurrentUser('id') studentId: string) {
    return this.intelligence.getLearningStreak(studentId);
  }

  // ─── Student analytics (for admin/teacher/parent) ─────────

  @Get('students/:id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: 'Full analytics report for a specific student' })
  studentReport(
    @Param('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.analytics.getStudentReport(studentId, schoolId);
  }

  @Get('students/:id/weak-topics')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "Student weak topics from practice history" })
  studentWeakTopics(
    @Param('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.intelligence.getWeakTopics(studentId, schoolId);
  }

  @Get('students/:id/strong-topics')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Student strong topics from practice history" })
  studentStrongTopics(
    @Param('id') studentId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.intelligence.getStrongTopics(studentId, schoolId);
  }

  @Get('students/:id/streak')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "Student learning streak" })
  studentStreak(@Param('id') studentId: string) {
    return this.intelligence.getLearningStreak(studentId);
  }
}
