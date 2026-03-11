import { Module } from '@nestjs/common';

// Services
import { GamesService } from './games.service';
import { GameTemplatesService } from './game-templates.service';
import { GameLevelsService } from './game-levels.service';
import { GameAdminService } from './game-admin.service';
import { GamificationService } from './gamification.service';

// Controllers
import { GamesController } from './games.controller';
import { GameAdminController } from './controllers/game-admin.controller';
import { GameLevelsController } from './controllers/game-levels.controller';
import { GamificationController } from './controllers/gamification.controller';

/**
 * Games Module — Game Engine System
 *
 * APIs mounted under /api/v1:
 *  /games             → Catalog browse, progress, leaderboard (GamesController)
 *  /games/admin       → Template browser, create/publish/clone (GameAdminController)
 *  /games/:id/levels  → Level CRUD + bulk add (GameLevelsController)
 *  /gamification      → XP, level, badges, school/classroom leaderboard
 *
 * Template types:
 *  QUIZ | DRAG_DROP | MEMORY_MATCH | WORD_BUILDER | PUZZLE | RUNNER | MATCHING
 */
@Module({
  controllers: [
    GamesController,
    GameAdminController,
    GameLevelsController,
    GamificationController,
  ],
  providers: [
    GamesService,
    GameTemplatesService,
    GameLevelsService,
    GameAdminService,
    GamificationService,
  ],
  exports: [GamesService, GamificationService, GameTemplatesService],
})
export class GamesModule {}
