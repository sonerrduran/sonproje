import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  private readonly LEADERBOARD_TTL = 60; // 60 second cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(params: { subject?: string; search?: string; page?: number; limit?: number }) {
    const { subject, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where = {
      status: 'PUBLISHED' as const,
      ...(subject && { subject }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { tags: { has: search } },
        ],
      }),
    };

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: { _count: { select: { levels: true } } },
        skip, take: limit,
        orderBy: { title: 'asc' },
      }),
      this.prisma.game.count({ where }),
    ]);

    return { data: games, meta: { total, page, limit } };
  }

  async findById(id: string) {
    const cacheKey = `game:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const game = await this.prisma.game.findUnique({
      where: { id },
      include: { levels: { orderBy: { levelNum: 'asc' } } },
    });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    await this.redis.set(cacheKey, game, 3600); // 1 hour cache
    return game;
  }

  async getProgress(gameId: string, studentId: string) {
    const progress = await this.prisma.gameProgress.findUnique({
      where: { studentId_gameId: { studentId, gameId } },
    });
    return progress ?? { studentId, gameId, currentLevel: 1, totalScore: 0, levelsData: {} };
  }

  async saveProgress(
    gameId: string, studentId: string, schoolId: string,
    levelNum: number, result: { score: number; maxScore: number; stars: 0|1|2|3; timeUsedSeconds: number },
  ) {
    const existing = await this.prisma.gameProgress.findUnique({
      where: { studentId_gameId: { studentId, gameId } },
    });

    const prevLevel = (existing?.levelsData as Record<string, { highScore: number; stars: number; attempts: number; completed: boolean }> | null)?.[levelNum] ?? {};
    const merged = {
      completed: result.stars > 0,
      stars: Math.max(prevLevel.stars ?? 0, result.stars),
      highScore: Math.max(prevLevel.highScore ?? 0, result.score),
      attempts: (prevLevel.attempts ?? 0) + 1,
      lastPlayedAt: new Date().toISOString(),
    };

    const updatedLevelsData = { ...(existing?.levelsData as object ?? {}), [levelNum]: merged };

    const updated = await this.prisma.gameProgress.upsert({
      where: { studentId_gameId: { studentId, gameId } },
      create: { studentId, gameId, schoolId, levelsData: updatedLevelsData, currentLevel: levelNum, totalScore: result.score },
      update: {
        levelsData: updatedLevelsData,
        currentLevel: Math.max(existing?.currentLevel ?? 1, levelNum),
        totalScore: { increment: result.score },
        lastPlayedAt: new Date(),
      },
    });

    // Update Redis leaderboard (sorted set — descending by score)
    await this.redis.zAdd(`lb:game:${gameId}:school:${schoolId}`, updated.totalScore, studentId, this.LEADERBOARD_TTL * 60);

    return updated;
  }

  async getLeaderboard(gameId: string, schoolId: string) {
    const cacheKey = `lb:game:${gameId}:school:${schoolId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const topStudents = await this.prisma.gameProgress.findMany({
      where: { gameId, schoolId },
      orderBy: { totalScore: 'desc' },
      take: 10,
      include: { student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.redis.set(cacheKey, topStudents, this.LEADERBOARD_TTL);
    return topStudents;
  }
}
