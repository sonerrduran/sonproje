import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'Browse the game catalog (all published games)' })
  findAll(
    @Query('subject') subject?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.gamesService.findAll({ subject, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game details including all levels' })
  findOne(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }

  @Get(':id/progress')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get current student\'s progress in this game' })
  getProgress(
    @Param('id') gameId: string,
    @CurrentUser('id') studentId: string,
  ) {
    return this.gamesService.getProgress(gameId, studentId);
  }

  @Post(':id/progress')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Save level result — updates best scores, never overwrites with lower' })
  saveProgress(
    @Param('id') gameId: string,
    @CurrentUser('id') studentId: string,
    @CurrentSchool() schoolId: string,
    @Body() body: {
      levelNum: number;
      score: number; maxScore: number;
      stars: 0 | 1 | 2 | 3;
      timeUsedSeconds: number;
    },
  ) {
    return this.gamesService.saveProgress(gameId, studentId, schoolId, body.levelNum, body);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get school leaderboard for this game (top 10)' })
  getLeaderboard(
    @Param('id') gameId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.gamesService.getLeaderboard(gameId, schoolId);
  }
}
