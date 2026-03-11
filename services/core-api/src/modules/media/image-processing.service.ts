import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ThumbnailSet {
  original: ProcessedImage;
  large: ProcessedImage;    // 1200px
  medium: ProcessedImage;   // 600px
  small: ProcessedImage;    // 300px
  thumb: ProcessedImage;    // 100px (square)
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  // ─── Full thumbnail set ───────────────────────────────────

  async processImageSet(buffer: Buffer, mimeType: string): Promise<ThumbnailSet> {
    const isSvg = mimeType === 'image/svg+xml';

    // SVG: skip processing, just return as-is
    if (isSvg) {
      const info: ProcessedImage = { buffer, width: 0, height: 0, format: 'svg', size: buffer.length };
      return { original: info, large: info, medium: info, small: info, thumb: info };
    }

    const [original, large, medium, small, thumb] = await Promise.all([
      this.optimize(buffer),
      this.resize(buffer, 1200),
      this.resize(buffer, 600),
      this.resize(buffer, 300),
      this.generateThumb(buffer, 100),
    ]);

    return { original, large, medium, small, thumb };
  }

  // ─── Optimize (strip metadata, recompress) ────────────────

  async optimize(buffer: Buffer, quality = 85): Promise<ProcessedImage> {
    const instance = sharp(buffer);
    const meta = await instance.metadata();

    let processed: Buffer;
    let format = meta.format ?? 'jpeg';

    switch (meta.format) {
      case 'png':
        processed = await instance.png({ compressionLevel: 9, quality }).toBuffer();
        break;
      case 'gif':
        // For GIFs, skip heavy processing
        processed = buffer;
        break;
      default:
        processed = await instance.webp({ quality }).toBuffer();
        format = 'webp';
    }

    const { width = 0, height = 0 } = await sharp(processed).metadata();
    return { buffer: processed, width, height, format, size: processed.length };
  }

  // ─── Resize by width ──────────────────────────────────────

  async resize(buffer: Buffer, maxWidth: number, quality = 80): Promise<ProcessedImage> {
    const processed = await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    const { width = 0, height = 0 } = await sharp(processed).metadata();
    return { buffer: processed, width, height, format: 'webp', size: processed.length };
  }

  // ─── Square thumbnail (center crop) ──────────────────────

  async generateThumb(buffer: Buffer, size = 100): Promise<ProcessedImage> {
    const processed = await sharp(buffer)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .webp({ quality: 70 })
      .toBuffer();

    return { buffer: processed, width: size, height: size, format: 'webp', size: processed.length };
  }

  // ─── Game asset optimization ──────────────────────────────

  async processGameAsset(buffer: Buffer, type: 'sprite' | 'icon' | 'background'): Promise<ProcessedImage> {
    switch (type) {
      case 'icon':
        return this.generateThumb(buffer, 128);
      case 'sprite':
        return this.resize(buffer, 512, 90);
      case 'background':
        return this.resize(buffer, 1920, 85);
      default:
        return this.optimize(buffer);
    }
  }

  // ─── Get image info ───────────────────────────────────────

  async getMetadata(buffer: Buffer): Promise<{ width: number; height: number; format: string; size: number }> {
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? 'unknown',
      size: buffer.length,
    };
  }

  // ─── Blur placeholder (LQIP) ──────────────────────────────

  async generatePlaceholder(buffer: Buffer): Promise<string> {
    const tiny = await sharp(buffer)
      .resize(20, 20, { fit: 'inside' })
      .blur(1)
      .webp({ quality: 20 })
      .toBuffer();

    return `data:image/webp;base64,${tiny.toString('base64')}`;
  }
}
