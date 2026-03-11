import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);
  private readonly CACHE_TTL = 300; // 5 min

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findById(id: string) {
    const cacheKey = `school:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { users: true, classrooms: true } } },
    });
    if (!school) throw new NotFoundException(`School ${id} not found`);

    await this.redis.set(cacheKey, school, this.CACHE_TTL);
    return school;
  }

  async update(id: string, data: { name?: string; email?: string; phone?: string; country?: string }) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException(`School ${id} not found`);

    const updated = await this.prisma.school.update({ where: { id }, data });
    await this.redis.del(`school:${id}`);
    this.logger.log(`School ${id} updated`);
    return updated;
  }

  async updateBranding(id: string, branding: Record<string, unknown>) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException(`School ${id} not found`);

    const updated = await this.prisma.school.update({
      where: { id },
      data: { branding },
    });
    await this.redis.del(`school:${id}`);
    return updated;
  }

  async updateConfig(id: string, config: Record<string, unknown>) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException(`School ${id} not found`);

    const existing = school.config as Record<string, unknown>;
    const updated = await this.prisma.school.update({
      where: { id },
      data: { config: { ...existing, ...config } },
    });
    await this.redis.del(`school:${id}`);
    return updated;
  }

  async getStats(id: string) {
    const [userCounts, lessonCount, gameProgress] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { schoolId: id },
        _count: true,
      }),
      this.prisma.lesson.count({ where: { schoolId: id, status: 'PUBLISHED' } }),
      this.prisma.gameProgress.count({ where: { schoolId: id } }),
    ]);

    return {
      users: Object.fromEntries(userCounts.map((r) => [r.role, r._count])),
      publishedLessons: lessonCount,
      gamePlays: gameProgress,
    };
  }
}
