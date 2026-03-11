import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GameAdminService } from './game-admin.service';
import { GameTemplatesService } from './game-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('games-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('games/admin')
export class GameAdminController {
  constructor(
    private readonly adminService: GameAdminService,
    private readonly templatesService: GameTemplatesService,
  ) {}

  // ─── Templates ────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'List all game templates (QUIZ, DRAG_DROP, MEMORY_MATCH, etc.)' })
  listTemplates() {
    return this.templatesService.findAll();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template details including content schema and example level' })
  getTemplate(@Param('id') id: string) {
    const template = this.templatesService.findById(id as never);
    if (!template) throw new Error(`Template "${id}" not found`);
    return template;
  }

  // ─── My Games (Teacher view) ──────────────────────────────

  @Get('my-games')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List games I manage (teachers see own, admins see all)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'templateId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  listMyGames(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: string,
    @Query('templateId') templateId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listManagedGames(schoolId, userId, role, { status, templateId, page, limit });
  }

  // ─── CRUD ─────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new game from a template' })
  create(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') teacherId: string,
    @Body() data: {
      title: string; templateId: string; subject?: string;
      gradeLevel?: string; language?: string; description?: string;
      thumbnailUrl?: string; tags?: string[];
    },
  ) {
    return this.adminService.createGame(schoolId, teacherId, data);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update game metadata' })
  update(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() data: { title?: string; subject?: string; gradeLevel?: string; description?: string; tags?: string[] },
  ) {
    return this.adminService.updateGame(id, schoolId, data);
  }

  @Post(':id/publish')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft game (requires at least 1 level)' })
  publish(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.adminService.publishGame(id, schoolId);
  }

  @Post(':id/archive')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a game' })
  archive(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.adminService.archiveGame(id, schoolId);
  }

  @Post(':id/clone')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a game (with all levels) to same or another school' })
  clone(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() body: { targetSchoolId?: string; title?: string },
  ) {
    return this.adminService.cloneGame(id, schoolId, body.targetSchoolId ?? schoolId, body.title);
  }

  @Get(':id/stats')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get game engagement stats (plays, players, avg score)' })
  stats(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.adminService.getGameStats(id, schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a game from catalog (soft delete)' })
  remove(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.adminService.deleteGame(id, schoolId);
  }
}
