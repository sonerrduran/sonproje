import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GameTemplatesService, TemplateId } from './game-templates.service';

@Injectable()
export class GameLevelsService {
  private readonly logger = new Logger(GameLevelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly templates: GameTemplatesService,
  ) {}

  async listLevels(gameId: string) {
    return this.prisma.gameLevel.findMany({
      where: { gameId },
      orderBy: { levelNum: 'asc' },
    });
  }

  async getLevel(gameId: string, levelNum: number) {
    const level = await this.prisma.gameLevel.findFirst({
      where: { gameId, levelNum },
    });
    if (!level) throw new NotFoundException(`Level ${levelNum} not found in game ${gameId}`);
    return level;
  }

  async addLevel(
    gameId: string,
    schoolId: string,
    data: {
      title?: string;
      content?: Record<string, unknown>;
      config?: Record<string, unknown>;
      xpReward?: number;
      passingScore?: number;
    },
  ) {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, schoolId } });
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);

    const lastLevel = await this.prisma.gameLevel.findFirst({
      where: { gameId },
      orderBy: { levelNum: 'desc' },
      select: { levelNum: true },
    });
    const levelNum = (lastLevel?.levelNum ?? 0) + 1;

    // Merge with template defaults
    const templateDefaults = game.templateId
      ? this.templates.getLevelDefaults(game.templateId as TemplateId)
      : {};

    const level = await this.prisma.gameLevel.create({
      data: {
        gameId,
        levelNum,
        title: data.title ?? `Level ${levelNum}`,
        content: data.content ?? {},
        config: { ...templateDefaults, ...(data.config ?? {}) },
        xpReward: data.xpReward ?? levelNum * 20,
        passingScore: data.passingScore ?? 60,
      },
    });

    await this.invalidateGameCache(gameId);
    this.logger.log(`Level ${levelNum} added to game ${gameId}`);
    return level;
  }

  async updateLevel(
    gameId: string,
    levelNum: number,
    schoolId: string,
    data: {
      title?: string;
      content?: Record<string, unknown>;
      config?: Record<string, unknown>;
      xpReward?: number;
      passingScore?: number;
      isLocked?: boolean;
    },
  ) {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, schoolId } });
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);

    const level = await this.prisma.gameLevel.findFirst({ where: { gameId, levelNum } });
    if (!level) throw new NotFoundException(`Level ${levelNum} not found`);

    const updated = await this.prisma.gameLevel.update({
      where: { id: level.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.xpReward !== undefined && { xpReward: data.xpReward }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
        ...(data.isLocked !== undefined && { isLocked: data.isLocked }),
      },
    });

    await this.invalidateGameCache(gameId);
    return updated;
  }

  async deleteLevel(gameId: string, levelNum: number, schoolId: string) {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, schoolId } });
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);

    const total = await this.prisma.gameLevel.count({ where: { gameId } });
    if (total <= 1) throw new BadRequestException('A game must have at least 1 level');

    const level = await this.prisma.gameLevel.findFirst({ where: { gameId, levelNum } });
    if (!level) throw new NotFoundException(`Level ${levelNum} not found`);

    await this.prisma.gameLevel.delete({ where: { id: level.id } });

    // Re-number subsequent levels
    const remaining = await this.prisma.gameLevel.findMany({
      where: { gameId },
      orderBy: { levelNum: 'asc' },
    });
    await Promise.all(
      remaining.map((l, i) =>
        this.prisma.gameLevel.update({ where: { id: l.id }, data: { levelNum: i + 1 } })
      ),
    );

    await this.invalidateGameCache(gameId);
    return { message: `Level ${levelNum} deleted, remaining levels renumbered` };
  }

  async bulkAddLevels(
    gameId: string,
    schoolId: string,
    levels: Array<{
      title?: string;
      content?: Record<string, unknown>;
      config?: Record<string, unknown>;
      xpReward?: number;
      passingScore?: number;
    }>,
  ) {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, schoolId } });
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);

    const lastLevel = await this.prisma.gameLevel.findFirst({
      where: { gameId },
      orderBy: { levelNum: 'desc' },
      select: { levelNum: true },
    });
    let nextNum = (lastLevel?.levelNum ?? 0) + 1;

    const templateDefaults = game.templateId
      ? this.templates.getLevelDefaults(game.templateId as TemplateId)
      : {};

    const created = await this.prisma.$transaction(
      levels.map((l) => {
        const num = nextNum++;
        return this.prisma.gameLevel.create({
          data: {
            gameId,
            levelNum: num,
            title: l.title ?? `Level ${num}`,
            content: l.content ?? {},
            config: { ...templateDefaults, ...(l.config ?? {}) },
            xpReward: l.xpReward ?? num * 20,
            passingScore: l.passingScore ?? 60,
          },
        });
      }),
    );

    await this.invalidateGameCache(gameId);
    this.logger.log(`${created.length} levels bulk-added to game ${gameId}`);
    return { added: created.length, levels: created };
  }

  private async invalidateGameCache(gameId: string) {
    await this.redis.del(`game:${gameId}`);
  }
}
