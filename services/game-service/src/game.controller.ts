import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GameService } from './game.service';
import {
  CreateGameSessionDto,
  CompleteGameSessionDto,
} from './dto/game.dto';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  // ═══════════════════════════════════════════════════════════
  // GAME CATEGORIES
  // ═══════════════════════════════════════════════════════════

  @Get('categories')
  async getCategories() {
    const categories = await this.gameService.getCategories();
    return {
      success: true,
      data: categories,
    };
  }

  @Get('categories/:id')
  async getCategoryById(@Param('id') id: string) {
    const category = await this.gameService.getCategoryById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return {
      success: true,
      data: category,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GAMES
  // ═══════════════════════════════════════════════════════════

  @Get()
  async getGames(
    @Query('categoryId') categoryId?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    const games = await this.gameService.getGames({
      categoryId,
      gradeLevel: gradeLevel ? parseInt(gradeLevel) : undefined,
      difficulty,
    });
    return {
      success: true,
      data: games,
    };
  }

  @Get(':id')
  async getGameById(@Param('id') id: string) {
    const game = await this.gameService.getGameById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return {
      success: true,
      data: game,
    };
  }

  @Get(':id/content')
  async getGameContent(@Param('id') id: string) {
    const content = await this.gameService.getGameContent(id);
    return {
      success: true,
      data: content,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GAME SESSIONS
  // ═══════════════════════════════════════════════════════════

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() createSessionDto: CreateGameSessionDto) {
    return this.gameService.createSession(createSessionDto);
  }

  @Put('sessions/:id')
  async completeSession(
    @Param('id') id: string,
    @Body() completeSessionDto: CompleteGameSessionDto,
  ) {
    const session = await this.gameService.completeSession(
      id,
      completeSessionDto,
    );
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return {
      success: true,
      data: session,
    };
  }

  @Get('sessions/user/:userId')
  async getUserSessions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.gameService.getUserSessions(
      userId,
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      data: sessions,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════

  @Get('leaderboard/global')
  async getGlobalLeaderboard(@Query('limit') limit?: string) {
    const leaderboard = await this.gameService.getGlobalLeaderboard(
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      data: leaderboard,
    };
  }

  @Get('leaderboard/game/:gameCode')
  async getGameLeaderboard(
    @Param('gameCode') gameCode: string,
    @Query('limit') limit?: string,
  ) {
    const leaderboard = await this.gameService.getGameLeaderboard(
      gameCode,
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      data: leaderboard,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // DAILY CHALLENGE
  // ═══════════════════════════════════════════════════════════

  @Get('daily-challenge')
  async getDailyChallenge() {
    const challenge = await this.gameService.getDailyChallenge();
    return {
      success: true,
      data: challenge,
    };
  }

  @Post('daily-challenge/:id/complete')
  async completeDailyChallenge(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const completion = await this.gameService.completeDailyChallenge(
      id,
      body.userId,
    );
    return {
      success: true,
      data: completion,
    };
  }
}
