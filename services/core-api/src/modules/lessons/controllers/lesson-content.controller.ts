import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentBlockType, UserRole } from '@prisma/client';
import { LessonContentService } from './lesson-content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons/:lessonId/content')
export class LessonContentController {
  constructor(private readonly service: LessonContentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all content blocks for a lesson in order' })
  getBlocks(@Param('lessonId') lessonId: string, @CurrentSchool() schoolId: string) {
    return this.service.getBlocks(lessonId, schoolId);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Append a content block to the lesson' })
  addBlock(
    @Param('lessonId') lessonId: string,
    @CurrentSchool() schoolId: string,
    @Body() body: { type: ContentBlockType; content: string; metadata?: Record<string, unknown> },
  ) {
    return this.service.addBlock(lessonId, schoolId, body);
  }

  @Post('bulk')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Add multiple content blocks at once (used by AI generation)' })
  bulkAdd(
    @Param('lessonId') lessonId: string,
    @CurrentSchool() schoolId: string,
    @Body('blocks') blocks: Array<{ type: ContentBlockType; content: string; metadata?: Record<string, unknown> }>,
  ) {
    return this.service.bulkAddBlocks(lessonId, schoolId, blocks);
  }

  @Put('reorder')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder content blocks by providing ordered block IDs' })
  reorder(
    @Param('lessonId') lessonId: string,
    @CurrentSchool() schoolId: string,
    @Body('order') order: string[],
  ) {
    return this.service.reorderBlocks(lessonId, schoolId, order);
  }

  @Patch(':blockId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update a content block content or metadata' })
  updateBlock(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @CurrentSchool() schoolId: string,
    @Body() body: { content?: string; metadata?: Record<string, unknown> },
  ) {
    return this.service.updateBlock(blockId, lessonId, schoolId, body);
  }

  @Delete(':blockId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a content block (auto-renumbers remaining)' })
  deleteBlock(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @CurrentSchool() schoolId: string,
  ) {
    return this.service.deleteBlock(blockId, lessonId, schoolId);
  }
}
