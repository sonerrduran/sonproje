import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Services
import { CloudStorageService } from './cloud-storage.service';
import { ImageProcessingService } from './image-processing.service';
import { MediaService } from './media.service';

// Controller
import { MediaController } from './media.controller';

/**
 * Media Module — Media & Asset Management System
 *
 * APIs at /api/v1/media:
 *  GET    /media                      → browse files (filtered)
 *  GET    /media/dashboard            → storage dashboard (admin)
 *  GET    /media/:id                  → file details
 *  POST   /media/upload               → server-side upload (Multer)
 *  POST   /media/game-assets/:gameId  → game asset upload (auto-processed by type)
 *  POST   /media/presign              → get presigned URL (direct client upload)
 *  POST   /media/presign/:id/confirm  → confirm presigned upload complete
 *  DELETE /media/:id                  → delete from storage + DB
 *
 * Storage Backends (configure via environment):
 *  - AWS S3          (set STORAGE_ENDPOINT to default)
 *  - Cloudflare R2   (set STORAGE_ENDPOINT to R2 URL, STORAGE_REGION=auto)
 *  - MinIO           (set STORAGE_FORCE_PATH_STYLE=true)
 *
 * Environment Variables:
 *  STORAGE_BUCKET         = my-education-bucket
 *  STORAGE_REGION         = us-east-1 (or 'auto' for R2)
 *  STORAGE_ENDPOINT       = https://xxx.r2.cloudflarestorage.com (for R2/MinIO)
 *  STORAGE_ACCESS_KEY_ID  = xxx
 *  STORAGE_SECRET_KEY     = xxx
 *  STORAGE_CDN_BASE_URL   = https://cdn.yourdomain.com (optional)
 *  STORAGE_FORCE_PATH_STYLE = false (set true for MinIO)
 */
@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // Keep in buffer for processing
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    }),
  ],
  controllers: [MediaController],
  providers: [
    CloudStorageService,
    ImageProcessingService,
    MediaService,
  ],
  exports: [MediaService, CloudStorageService, ImageProcessingService],
})
export class MediaModule {}
