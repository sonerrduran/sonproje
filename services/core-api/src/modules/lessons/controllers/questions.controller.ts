import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QuestionType, QuestionDifficulty, UserRole } from '@prisma/client';
import { QuestionsService } from '../questions.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../../common/decorators/current-user.decorator';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly service: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List questions with optional filters' })
  @ApiQuery({ name: 'lessonId', required: false })
  @ApiQuery({ name: 'type', enum: QuestionType, required: false })
  @ApiQuery({ name: 'difficulty', enum: QuestionDifficulty, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(
    @CurrentSchool() schoolId: string,
    @Query('lessonId') lessonId?: string,
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: QuestionDifficulty,
    @Query('subject') subject?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(schoolId, { lessonId, type, difficulty, subject, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single question' })
  findOne(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.findById(id, schoolId);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create a practice question' })
  create(
    @CurrentSchool() schoolId: string,
    @Body() body: {
      lessonId?: string; type: QuestionType; body: string;
      options?: Array<{ id: string; text: string }>;
      answer: { correct: string | string[]; explanation?: string };
      difficulty?: QuestionDifficulty; language?: string; tags?: string[];
    },
  ) {
    return this.service.create(schoolId, body);
  }

  @Post('bulk')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk-create questions for a lesson (used by AI generation)' })
  bulkCreate(
    @CurrentSchool() schoolId: string,
    @Body() body: { lessonId: string; questions: Array<{ type: QuestionType; body: string; answer: Record<string, unknown> }> },
  ) {
    return this.service.bulkCreate(schoolId, body.lessonId, body.questions as never);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update a question' })
  update(
    @Param('id') id: string,
    @CurrentSchool() schoolId: string,
    @Body() body: Record<string, never>,
  ) {
    return this.service.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a question' })
  remove(@Param('id') id: string, @CurrentSchool() schoolId: string) {
    return this.service.remove(id, schoolId);
  }
}
