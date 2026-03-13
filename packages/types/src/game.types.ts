// Game Types

export enum Difficulty {
  VERY_EASY = 'VERY_EASY',
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  VERY_HARD = 'VERY_HARD'
}

export interface UserStats {
  stars: number;
  badges: string[];
  solvedProblems: number;
  gradeLevel: number;
  currentAvatar: string;
  fastReadingWpm?: number;
  fastReadingLevel?: number;
  fastReadingComprehensionAvg?: number;
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: number | string;
  explanation?: string;
  points?: number;
  hint?: string;
  image?: string;
}

export interface GameFilters {
  category?: string;
  gradeLevel?: number;
  difficulty?: Difficulty;
  tags?: string[];
}

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  score: number;
  completed: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface CreateSessionDto {
  gameId: string;
}

export interface CompleteSessionDto {
  sessionId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  duration: number;
}
