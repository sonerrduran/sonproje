import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GameLevelsService } from '../game-levels.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('game-levels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('games/:gameId/levels')
export class GameLevelsController {
  constructor(private readonly levelsService: GameLevelsService) {}

  @Get()
  @ApiOperation({ summary: 'List all levels in a game (ordered by level number)' })
  list(@Param('gameId') gameId: string) {
    return this.levelsService.listLevels(gameId);
  }

  @Get(':levelNum')
  @ApiOperation({ summary: 'Get a specific level with full content' })
  getLevel(@Param('gameId') gameId: string, @Param('levelNum') levelNum: number) {
    return this.levelsService.getLevel(gameId, +levelNum);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a new level to the game (auto-assigned next level number)' })
  add(
    @Param('gameId') gameId: string,
    @CurrentSchool() schoolId: string,
    @Body() data: { title?: string; content?: Record<string, unknown>; config?: Record<string, unknown>; xpReward?: number; passingScore?: number },
  ) {
    return this.levelsService.addLevel(gameId, schoolId, data);
  }

  @Post('bulk')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk-add multiple levels at once (useful for AI generation)' })
  bulkAdd(
    @Param('gameId') gameId: string,
    @CurrentSchool() schoolId: string,
    @Body('levels') levels: Array<{ title?: string; content?: Record<string, unknown>; config?: Record<string, unknown>; xpReward?: number; passingScore?: number }>,
  ) {
    return this.levelsService.bulkAddLevels(gameId, schoolId, levels);
  }

  @Patch(':levelNum')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update level content, config, XP reward, or lock status' })
  update(
    @Param('gameId') gameId: string,
    @Param('levelNum') levelNum: number,
    @CurrentSchool() schoolId: string,
    @Body() data: { title?: string; content?: Record<string, unknown>; config?: Record<string, unknown>; xpReward?: number; passingScore?: number; isLocked?: boolean },
  ) {
    return this.levelsService.updateLevel(gameId, +levelNum, schoolId, data);
  }

  @Delete(':levelNum')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a level (remaining levels auto-renumbered)' })
  remove(
    @Param('gameId') gameId: string,
    @Param('levelNum') levelNum: number,
    @CurrentSchool() schoolId: string,
  ) {
    return this.levelsService.deleteLevel(gameId, +levelNum, schoolId);
  }
}
