import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export type MediaCategory =
  | 'avatars'
  | 'lesson-images'
  | 'lesson-videos'
  | 'lesson-audio'
  | 'game-assets'
  | 'game-thumbnails'
  | 'school-assets'
  | 'temp';

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl?: string;
  size: number;
  mimeType: string;
  etag?: string;
}

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
  document: ['application/pdf'],
};

const ALL_ALLOWED = Object.values(ALLOWED_TYPES).flat();
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string | undefined;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('storage.bucket', 'education-platform');
    this.cdnBase = config.get<string>('storage.cdnBaseUrl');
    this.region = config.get<string>('storage.region', 'auto');

    this.s3 = new S3Client({
      region: this.region,
      endpoint: config.get<string>('storage.endpoint'),         // For R2/MinIO
      credentials: {
        accessKeyId: config.get<string>('storage.accessKeyId', ''),
        secretAccessKey: config.get<string>('storage.secretAccessKey', ''),
      },
      forcePathStyle: config.get<boolean>('storage.forcePathStyle', false), // MinIO requires true
    });
  }

  // ─── Upload buffer ────────────────────────────────────────

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    category: MediaCategory,
    schoolId: string,
    uploadedBy: string,
  ): Promise<UploadResult> {
    this.validateMimeType(mimeType);

    const ext = path.extname(originalName).toLowerCase() || this.mimeToExt(mimeType);
    const key = this.buildKey(category, schoolId, ext);

    try {
      const result = await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.length,
          Metadata: {
            uploadedBy,
            schoolId,
            originalName: encodeURIComponent(originalName),
          },
          CacheControl: category === 'temp' ? 'no-cache' : 'public, max-age=31536000',
        }),
      );

      const url = this.buildPublicUrl(key);
      this.logger.log(`Uploaded: ${key} (${buffer.length} bytes) by ${uploadedBy}`);

      return {
        key,
        url,
        cdnUrl: this.cdnBase ? `${this.cdnBase}/${key}` : url,
        size: buffer.length,
        mimeType,
        etag: result.ETag,
      };
    } catch (err) {
      this.logger.error(`Upload failed: ${key}`, err);
      throw new InternalServerErrorException('File upload failed. Please try again.');
    }
  }

  // ─── Presigned URL (direct client upload) ─────────────────

  async createPresignedUploadUrl(
    category: MediaCategory,
    schoolId: string,
    uploadedBy: string,
    mimeType: string,
    originalName: string,
    expiresInSeconds = 300,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string; cdnUrl?: string }> {
    this.validateMimeType(mimeType);
    const ext = path.extname(originalName).toLowerCase() || this.mimeToExt(mimeType);
    const key = this.buildKey(category, schoolId, ext);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: { uploadedBy, schoolId, originalName: encodeURIComponent(originalName) },
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    const publicUrl = this.buildPublicUrl(key);

    return {
      uploadUrl,
      key,
      publicUrl,
      cdnUrl: this.cdnBase ? `${this.cdnBase}/${key}` : publicUrl,
    };
  }

  // ─── Delete ───────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      this.logger.log(`Deleted: ${key}`);
    } catch (err) {
      this.logger.error(`Delete failed: ${key}`, err);
      throw new InternalServerErrorException('File deletion failed.');
    }
  }

  // ─── Check existence ──────────────────────────────────────

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  // ─── Presigned download URL (for private files) ───────────

  async createDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  // ─── List objects by prefix ───────────────────────────────

  async listByPrefix(prefix: string, maxKeys = 100) {
    const result = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, MaxKeys: maxKeys }),
    );
    return result.Contents ?? [];
  }

  // ─── Helpers ──────────────────────────────────────────────

  validateMimeType(mimeType: string): void {
    if (!ALL_ALLOWED.includes(mimeType)) {
      throw new Error(`File type "${mimeType}" is not allowed. Allowed: ${ALL_ALLOWED.join(', ')}`);
    }
  }

  getMimeCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    for (const [cat, types] of Object.entries(ALLOWED_TYPES)) {
      if (types.includes(mimeType)) return cat as never;
    }
    return 'document';
  }

  private buildKey(category: MediaCategory, schoolId: string, ext: string): string {
    const unique = crypto.randomBytes(12).toString('hex');
    const date = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `${schoolId}/${category}/${date}/${unique}${ext}`;
  }

  private buildPublicUrl(key: string): string {
    const endpoint = this.config.get<string>('storage.endpoint');
    if (endpoint) return `${endpoint}/${this.bucket}/${key}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
      'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'video/webm': '.webm',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '.bin';
  }
}
