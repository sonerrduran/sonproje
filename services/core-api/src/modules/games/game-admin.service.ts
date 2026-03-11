import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { GameStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GameTemplatesService, TemplateId } from './game-templates.service';

@Injectable()
export class GameAdminService {
  private readonly logger = new Logger(GameAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly templates: GameTemplatesService,
  ) {}

  async createGame(
    schoolId: string,
    teacherId: string,
    data: {
      title: string;
      templateId: string;
      subject?: string;
      gradeLevel?: string;
      language?: string;
      description?: string;
      thumbnailUrl?: string;
      tags?: string[];
    },
  ) {
    if (!this.templates.isValidTemplateId(data.templateId)) {
      throw new BadRequestException(
        `Invalid template "${data.templateId}". Valid templates: ${this.templates.findAll().map((t) => t.id).join(', ')}`,
      );
    }

    const game = await this.prisma.game.create({
      data: {
        schoolId,
        teacherId,
        templateId: data.templateId,
        title: data.title,
        subject: data.subject,
        gradeLevel: data.gradeLevel,
        language: data.language ?? 'en',
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        tags: data.tags ?? [],
        status: GameStatus.DRAFT,
      },
    });

    this.logger.log(`Game created: "${game.title}" [template: ${data.templateId}] school: ${schoolId}`);
    return game;
  }

  async updateGame(
    id: string,
    schoolId: string,
    data: {
      title?: string;
      subject?: string;
      gradeLevel?: string;
      language?: string;
      description?: string;
      thumbnailUrl?: string;
      tags?: string[];
    },
  ) {
    const game = await this.prisma.game.findFirst({ where: { id, schoolId } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    const updated = await this.prisma.game.update({ where: { id }, data });
    await this.redis.del(`game:${id}`);
    return updated;
  }

  async publishGame(id: string, schoolId: string) {
    const game = await this.prisma.game.findFirst({ where: { id, schoolId } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    const levelCount = await this.prisma.gameLevel.count({ where: { gameId: id } });
    if (levelCount === 0) {
      throw new BadRequestException('A game must have at least 1 level before publishing');
    }

    const updated = await this.prisma.game.update({
      where: { id },
      data: { status: GameStatus.PUBLISHED },
    });
    await this.redis.del(`game:${id}`);
    this.logger.log(`Game published: ${id}`);
    return updated;
  }

  async archiveGame(id: string, schoolId: string) {
    const game = await this.prisma.game.findFirst({ where: { id, schoolId } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    await this.prisma.game.update({ where: { id }, data: { status: GameStatus.ARCHIVED } });
    await this.redis.del(`game:${id}`);
    return { message: 'Game archived' };
  }

  async deleteGame(id: string, schoolId: string) {
    const game = await this.prisma.game.findFirst({ where: { id, schoolId } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    // Soft delete via archive instead of hard delete (preserves progress data)
    await this.prisma.game.update({ where: { id }, data: { status: GameStatus.ARCHIVED } });
    await this.redis.del(`game:${id}`);
    return { message: 'Game removed from catalog' };
  }

  async listManagedGames(
    schoolId: string,
    teacherId: string,
    role: string,
    params: { status?: string; templateId?: string; page?: number; limit?: number },
  ) {
    const { status, templateId, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      // Admins see all, teachers see their own
      ...(role === 'TEACHER' && { teacherId }),
      ...(status && { status: status as GameStatus }),
      ...(templateId && { templateId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: { _count: { select: { levels: true } } },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.game.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async cloneGame(
    id: string,
    schoolId: string,
    targetSchoolId: string,
    newTitle?: string,
  ) {
    const original = await this.prisma.game.findFirst({
      where: { id, schoolId },
      include: { levels: { orderBy: { levelNum: 'asc' } } },
    });
    if (!original) throw new NotFoundException(`Game ${id} not found`);

    const cloned = await this.prisma.$transaction(async (tx) => {
      const newGame = await tx.game.create({
        data: {
          schoolId: targetSchoolId,
          teacherId: original.teacherId,
          templateId: original.templateId,
          title: newTitle ?? `${original.title} (Copy)`,
          subject: original.subject,
          gradeLevel: original.gradeLevel,
          language: original.language,
          description: original.description,
          thumbnailUrl: original.thumbnailUrl,
          tags: original.tags,
          status: GameStatus.DRAFT,
        },
      });

      if (original.levels.length > 0) {
        await tx.gameLevel.createMany({
          data: original.levels.map((l) => ({
            gameId: newGame.id,
            levelNum: l.levelNum,
            title: l.title,
            content: l.content as object,
            config: l.config as object,
            xpReward: l.xpReward,
            passingScore: l.passingScore,
          })),
        });
      }

      return newGame;
    });

    this.logger.log(`Game cloned: ${id} → ${cloned.id}`);
    return cloned;
  }

  async getGameStats(id: string, schoolId: string) {
    const game = await this.prisma.game.findFirst({ where: { id, schoolId } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);

    const [levelCount, totalPlays, uniquePlayers, avgScore] = await Promise.all([
      this.prisma.gameLevel.count({ where: { gameId: id } }),
      this.prisma.gameProgress.count({ where: { gameId: id } }),
      this.prisma.gameProgress.groupBy({ by: ['studentId'], where: { gameId: id } }).then((r) => r.length),
      this.prisma.gameProgress.aggregate({ where: { gameId: id }, _avg: { totalScore: true } }),
    ]);

    return {
      levelCount,
      totalPlays,
      uniquePlayers,
      avgScore: Math.round(avgScore._avg.totalScore ?? 0),
    };
  }
}
