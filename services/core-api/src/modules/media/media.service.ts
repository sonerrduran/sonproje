import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CloudStorageService, MediaCategory, UploadResult } from './cloud-storage.service';
import { ImageProcessingService } from './image-processing.service';

export type AssetType = 'SPRITE' | 'ICON' | 'BACKGROUND' | 'SOUND_EFFECT' | 'MUSIC' | 'THUMBNAIL';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudStorageService,
    private readonly imageProcessor: ImageProcessingService,
  ) {}

  // ─── Universal Upload ─────────────────────────────────────

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    category: MediaCategory,
    schoolId: string,
    uploadedBy: string,
    generateThumbnails = false,
  ) {
    const MAX_SIZE = 100 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException(`File too large. Max size: 100MB`);
    }

    const isImage = IMAGE_MIME_TYPES.includes(mimeType);
    let uploadResult: UploadResult;
    let thumbnailUrl: string | undefined;
    let placeholderDataUri: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (isImage && mimeType !== 'image/svg+xml') {
      // Optimize original before storing
      const optimized = await this.imageProcessor.optimize(buffer);
      const meta = await this.imageProcessor.getMetadata(optimized.buffer);

      width = meta.width;
      height = meta.height;

      // Upload optimized original
      uploadResult = await this.storage.upload(
        optimized.buffer,
        originalName.replace(/\.[^.]+$/, '.webp'),
        'image/webp',
        category,
        schoolId,
        uploadedBy,
      );

      // Generate and upload thumbnail
      if (generateThumbnails) {
        const thumb = await this.imageProcessor.generateThumb(buffer, 200);
        const thumbResult = await this.storage.upload(
          thumb.buffer,
          originalName.replace(/\.[^.]+$/, '_thumb.webp'),
          'image/webp',
          category,
          schoolId,
          uploadedBy,
        );
        thumbnailUrl = thumbResult.cdnUrl ?? thumbResult.url;

        // Generate LQIP placeholder
        placeholderDataUri = await this.imageProcessor.generatePlaceholder(buffer);
      }
    } else {
      // Non-image: upload as-is
      uploadResult = await this.storage.upload(buffer, originalName, mimeType, category, schoolId, uploadedBy);
    }

    // Persist to database
    const mimeCategory = this.storage.getMimeCategory(mimeType);
    const mediaFile = await this.prisma.mediaFile.create({
      data: {
        schoolId,
        uploadedBy,
        key: uploadResult.key,
        url: uploadResult.cdnUrl ?? uploadResult.url,
        thumbnailUrl,
        placeholder: placeholderDataUri,
        mimeType,
        fileType: mimeCategory.toUpperCase() as never,
        size: uploadResult.size,
        width,
        height,
        originalName,
        category,
      },
    });

    this.logger.log(`Media saved: ${mediaFile.id} [${mimeType}] ${uploadResult.size} bytes`);
    return mediaFile;
  }

  // ─── Presigned Upload (direct to storage) ─────────────────

  async getPresignedUploadUrl(
    category: MediaCategory,
    schoolId: string,
    uploadedBy: string,
    mimeType: string,
    originalName: string,
  ) {
    const presigned = await this.storage.createPresignedUploadUrl(
      category, schoolId, uploadedBy, mimeType, originalName,
    );

    // Pre-create DB record with PENDING status
    const record = await this.prisma.mediaFile.create({
      data: {
        schoolId,
        uploadedBy,
        key: presigned.key,
        url: presigned.cdnUrl ?? presigned.publicUrl,
        mimeType,
        fileType: this.storage.getMimeCategory(mimeType).toUpperCase() as never,
        originalName,
        category,
        status: 'PENDING',
        size: 0,
      },
    });

    return {
      mediaId: record.id,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.cdnUrl ?? presigned.publicUrl,
      key: presigned.key,
      expiresIn: 300,
    };
  }

  // ─── Confirm presigned upload ─────────────────────────────

  async confirmPresignedUpload(mediaId: string, schoolId: string, size: number) {
    const media = await this.prisma.mediaFile.findFirst({ where: { id: mediaId, schoolId } });
    if (!media) throw new NotFoundException('Media record not found');

    return this.prisma.mediaFile.update({
      where: { id: mediaId },
      data: { status: 'ACTIVE', size },
    });
  }

  // ─── Delete ───────────────────────────────────────────────

  async delete(id: string, schoolId: string) {
    const media = await this.prisma.mediaFile.findFirst({ where: { id, schoolId } });
    if (!media) throw new NotFoundException('Media file not found');

    // Delete from storage
    await this.storage.delete(media.key);
    if (media.thumbnailUrl) {
      const thumbKey = media.key.replace(/(\.[^.]+)?$/, '_thumb.webp');
      await this.storage.delete(thumbKey).catch(() => {});
    }

    await this.prisma.mediaFile.delete({ where: { id } });
    this.logger.log(`Media deleted: ${id}`);
    return { message: 'File deleted successfully' };
  }

  // ─── Browse / Search ──────────────────────────────────────

  async findAll(
    schoolId: string,
    params: {
      category?: MediaCategory; fileType?: string; search?: string;
      page?: number; limit?: number; uploadedBy?: string;
    },
  ) {
    const { category, fileType, search, page = 1, limit = 30, uploadedBy } = params;
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      status: 'ACTIVE' as const,
      ...(category && { category }),
      ...(fileType && { fileType: fileType.toUpperCase() as never }),
      ...(uploadedBy && { uploadedBy }),
      ...(search && { originalName: { contains: search, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return { data, meta: { total, page, limit, hasNextPage: skip + limit < total } };
  }

  async findById(id: string, schoolId: string) {
    const media = await this.prisma.mediaFile.findFirst({ where: { id, schoolId } });
    if (!media) throw new NotFoundException('Media file not found');
    return media;
  }

  // ─── Dashboard / Stats ────────────────────────────────────

  async getDashboard(schoolId: string) {
    const [totalFiles, totalSize, byType, byCategory, recent, unused] = await Promise.all([
      this.prisma.mediaFile.count({ where: { schoolId, status: 'ACTIVE' } }),
      this.prisma.mediaFile.aggregate({ where: { schoolId, status: 'ACTIVE' }, _sum: { size: true } }),
      this.prisma.mediaFile.groupBy({
        by: ['fileType'],
        where: { schoolId, status: 'ACTIVE' },
        _count: true,
        _sum: { size: true },
      }),
      this.prisma.mediaFile.groupBy({
        by: ['category'],
        where: { schoolId, status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.mediaFile.findMany({
        where: { schoolId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, originalName: true, url: true, size: true, fileType: true, createdAt: true },
      }),
      // Unused files (not referenced anywhere)
      this.prisma.mediaFile.count({
        where: { schoolId, status: 'ACTIVE', createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
      }),
    ]);

    return {
      totalFiles,
      totalSizeBytes: totalSize._sum.size ?? 0,
      totalSizeMB: Math.round(((totalSize._sum.size ?? 0) / 1024 / 1024) * 100) / 100,
      byType: byType.map((t) => ({ type: t.fileType, count: t._count, sizeMB: Math.round(((t._sum.size ?? 0) / 1024 / 1024) * 100) / 100 })),
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
      recentUploads: recent,
      potentiallyUnused: unused,
    };
  }

  // ─── Game Asset Helpers ───────────────────────────────────

  async uploadGameAsset(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    assetType: AssetType,
    gameId: string,
    schoolId: string,
    uploadedBy: string,
  ) {
    let processedBuffer = buffer;

    // Process image game assets differently per type
    if (IMAGE_MIME_TYPES.includes(mimeType) && mimeType !== 'image/svg+xml') {
      const subType = assetType === 'ICON' ? 'icon' : assetType === 'BACKGROUND' ? 'background' : 'sprite';
      const processed = await this.imageProcessor.processGameAsset(buffer, subType);
      processedBuffer = processed.buffer;
    }

    const media = await this.uploadFile(
      processedBuffer,
      originalName,
      IMAGE_MIME_TYPES.includes(mimeType) ? 'image/webp' : mimeType,
      'game-assets',
      schoolId,
      uploadedBy,
    );

    // Tag with gameId in metadata via update
    await this.prisma.mediaFile.update({
      where: { id: media.id },
      data: { entityId: gameId, entityType: 'GAME', assetType },
    });

    return media;
  }
}
