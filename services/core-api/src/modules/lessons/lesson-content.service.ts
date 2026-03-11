import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ContentBlockType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LessonContentService {
  private readonly logger = new Logger(LessonContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getBlocks(lessonId: string, schoolId: string) {
    await this.assertLessonExists(lessonId, schoolId);
    return this.prisma.lessonContentBlock.findMany({
      where: { lessonId },
      orderBy: { orderNum: 'asc' },
    });
  }

  async addBlock(
    lessonId: string,
    schoolId: string,
    data: { type: ContentBlockType; content: string; metadata?: Record<string, unknown> },
  ) {
    await this.assertLessonExists(lessonId, schoolId);

    // Place at end by default
    const last = await this.prisma.lessonContentBlock.findFirst({
      where: { lessonId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const orderNum = (last?.orderNum ?? 0) + 1;

    const block = await this.prisma.lessonContentBlock.create({
      data: { lessonId, type: data.type, content: data.content, orderNum, metadata: data.metadata ?? {} },
    });

    await this.invalidateLessonCache(lessonId);
    this.logger.log(`Block added to lesson ${lessonId}: type=${data.type}`);
    return block;
  }

  async updateBlock(
    blockId: string,
    lessonId: string,
    schoolId: string,
    data: { content?: string; metadata?: Record<string, unknown> },
  ) {
    await this.assertLessonExists(lessonId, schoolId);
    const block = await this.prisma.lessonContentBlock.findFirst({ where: { id: blockId, lessonId } });
    if (!block) throw new NotFoundException('Content block not found');

    const updated = await this.prisma.lessonContentBlock.update({
      where: { id: blockId },
      data,
    });
    await this.invalidateLessonCache(lessonId);
    return updated;
  }

  async deleteBlock(blockId: string, lessonId: string, schoolId: string) {
    await this.assertLessonExists(lessonId, schoolId);
    const block = await this.prisma.lessonContentBlock.findFirst({ where: { id: blockId, lessonId } });
    if (!block) throw new NotFoundException('Content block not found');

    await this.prisma.lessonContentBlock.delete({ where: { id: blockId } });

    // Re-number blocks to keep order contiguous
    const remaining = await this.prisma.lessonContentBlock.findMany({
      where: { lessonId },
      orderBy: { orderNum: 'asc' },
    });
    await Promise.all(
      remaining.map((b, i) =>
        this.prisma.lessonContentBlock.update({ where: { id: b.id }, data: { orderNum: i + 1 } })
      ),
    );

    await this.invalidateLessonCache(lessonId);
    return { message: 'Block deleted and order updated' };
  }

  async reorderBlocks(lessonId: string, schoolId: string, order: string[]) {
    await this.assertLessonExists(lessonId, schoolId);

    const blocks = await this.prisma.lessonContentBlock.findMany({ where: { lessonId } });
    const ids = new Set(blocks.map((b) => b.id));
    if (order.some((id) => !ids.has(id))) {
      throw new BadRequestException('One or more block IDs are not part of this lesson');
    }

    await Promise.all(
      order.map((id, idx) =>
        this.prisma.lessonContentBlock.update({ where: { id }, data: { orderNum: idx + 1 } })
      ),
    );

    await this.invalidateLessonCache(lessonId);
    return this.getBlocks(lessonId, schoolId);
  }

  async bulkAddBlocks(
    lessonId: string,
    schoolId: string,
    blocks: Array<{ type: ContentBlockType; content: string; metadata?: Record<string, unknown> }>,
  ) {
    await this.assertLessonExists(lessonId, schoolId);

    const last = await this.prisma.lessonContentBlock.findFirst({
      where: { lessonId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    let nextOrder = (last?.orderNum ?? 0) + 1;

    const created = await this.prisma.$transaction(
      blocks.map((b) =>
        this.prisma.lessonContentBlock.create({
          data: { lessonId, type: b.type, content: b.content, orderNum: nextOrder++, metadata: b.metadata ?? {} },
        })
      ),
    );

    await this.invalidateLessonCache(lessonId);
    return created;
  }

  private async assertLessonExists(lessonId: string, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, schoolId } });
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    return lesson;
  }

  private async invalidateLessonCache(lessonId: string) {
    await this.redis.del(`lesson:${lessonId}`);
  }
}
