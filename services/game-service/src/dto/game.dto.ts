import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateGameSessionDto {
  @IsString()
  userId: string;

  @IsString()
  gameMode: string;

  @IsString()
  difficulty: string;

  @IsInt()
  grade: number;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;
}

export class CompleteGameSessionDto {
  @IsInt()
  @Min(0)
  score: number;

  @IsInt()
  @Min(0)
  starsEarned: number;

  @IsInt()
  @Min(0)
  xpEarned: number;

  @IsInt()
  @Min(0)
  correctAnswers: number;

  @IsInt()
  @Min(0)
  totalQuestions: number;

  @IsInt()
  @Min(0)
  durationSec: number;
}

export interface GameFilters {
  categoryId?: string;
  gradeLevel?: number;
  difficulty?: string;
}
