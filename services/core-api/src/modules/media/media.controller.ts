import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, UseInterceptors,
  UploadedFile, HttpCode, HttpStatus, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MediaService, AssetType } from './media.service';
import { CloudStorageService, MediaCategory } from './cloud-storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storage: CloudStorageService,
  ) {}

  // ─── Browse ───────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Browse media files with optional filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'fileType', enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'], required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('category') category?: MediaCategory,
    @Query('fileType') fileType?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.mediaService.findAll(schoolId, { category, fileType, search, page, limit });
  }

  @Get('dashboard')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Media dashboard: total files, storage used, breakdown by type/category' })
  getDashboard(@CurrentSchool() schoolId: string) {
    return this.mediaService.getDashboard(schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single media file record' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.mediaService.findById(id, schoolId);
  }

  // ─── Server-side upload ───────────────────────────────────

  @Post('upload')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload a file (image/video/audio) through the backend' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, category: { type: 'string' }, generateThumbnails: { type: 'boolean' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body('category') category: MediaCategory = 'lesson-images',
    @Body('generateThumbnails') generateThumbnails?: string,
  ) {
    return this.mediaService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      category,
      schoolId,
      userId,
      generateThumbnails === 'true',
    );
  }

  // ─── Game asset upload ────────────────────────────────────

  @Post('game-assets/:gameId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Upload a game asset (sprite, icon, background, sound)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  uploadGameAsset(
    @Param('gameId') gameId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body('assetType') assetType: AssetType = 'SPRITE',
  ) {
    return this.mediaService.uploadGameAsset(
      file.buffer,
      file.originalname,
      file.mimetype,
      assetType,
      gameId,
      schoolId,
      userId,
    );
  }

  // ─── Presigned (direct client → storage) ─────────────────

  @Post('presign')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get a presigned URL for direct client-to-storage upload (large files)' })
  getPresignedUrl(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { mimeType: string; originalName: string; category: MediaCategory },
  ) {
    return this.mediaService.getPresignedUploadUrl(
      body.category,
      schoolId,
      userId,
      body.mimeType,
      body.originalName,
    );
  }

  @Post('presign/:mediaId/confirm')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a presigned upload is complete (send final file size)' })
  confirmPresigned(
    @Param('mediaId') mediaId: string,
    @CurrentSchool() schoolId: string,
    @Body('size') size: number,
  ) {
    return this.mediaService.confirmPresignedUpload(mediaId, schoolId, size);
  }

  // ─── Delete ───────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a media file from storage and database' })
  remove(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.mediaService.delete(id, schoolId);
  }
}
