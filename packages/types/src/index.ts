// ============================================================
// @platform/types — Shared TypeScript Types
// Global SaaS Education Platform
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SCHOOL_ADMIN = 'school_admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
}

export enum LessonStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum GameStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  MAINTENANCE = 'maintenance',
}

export enum AiJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum AiJobType {
  LESSON = 'lesson',
  QUESTIONS = 'questions',
  EXPLANATION = 'explanation',
  SUMMARY = 'summary',
}

// ─── Common / Shared ─────────────────────────────────────────

export interface Timestamps {
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  status: number;
  title: string;
  detail?: string;
  traceId?: string;
  timestamp: string;
}

// ─── School / Tenant ─────────────────────────────────────────

export interface SchoolBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
}

export interface SchoolConfig {
  language: string;
  timezone: string;
  academicYearStart: string; // MM-DD
  features: {
    aiContent: boolean;
    payments: boolean;
    messaging: boolean;
    gamification: boolean;
  };
}

export interface School extends Timestamps {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  country?: string;
  branding: SchoolBranding;
  config: SchoolConfig;
  status: 'active' | 'suspended' | 'trial';
}

// ─── User ─────────────────────────────────────────────────────

export interface User extends Timestamps {
  id: string;
  schoolId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  language: string;
  status: 'active' | 'inactive';
}

export type UserProfile = User & {
  xp?: number;
  level?: number;
  streakDays?: number;
};

// ─── Classroom ─────────────────────────────────────────────────

export interface Classroom extends Timestamps {
  id: string;
  schoolId: string;
  name: string;
  gradeLevel?: string;
  section?: string;
  isArchived: boolean;
  studentCount?: number;
  teacherCount?: number;
}

// ─── Lesson ─────────────────────────────────────────────────

export type LessonContentBlockType = 'text' | 'heading' | 'image' | 'video' | 'example' | 'definition' | 'note' | 'quiz';

export interface LessonContentBlock {
  id: string;
  type: LessonContentBlockType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Lesson extends Timestamps {
  id: string;
  schoolId: string;
  teacherId?: string;
  title: string;
  subject?: string;
  gradeLevel?: string;
  language: string;
  status: LessonStatus;
  source: 'manual' | 'ai';
  contentBlocks: LessonContentBlock[];
  estimatedMinutes?: number;
  tags?: string[];
}

export interface LessonProgress {
  studentId: string;
  lessonId: string;
  progressPercent: number;
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
}

// ─── Practice / Questions ───────────────────────────────────

export type QuestionType = 'mcq' | 'fill_blank' | 'drag_drop' | 'matching' | 'true_false' | 'short_answer';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface Question extends Timestamps {
  id: string;
  schoolId: string;
  lessonId?: string;
  type: QuestionType;
  body: string;
  options?: QuestionOption[];
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: QuestionDifficulty;
  source: 'manual' | 'ai';
  language: string;
}

export interface PracticeAttempt {
  id: string;
  studentId: string;
  setId: string;
  score: number;
  maxScore: number;
  percentCorrect: number;
  startedAt: string;
  completedAt?: string;
}

// ─── Game ──────────────────────────────────────────────────

export interface GameLevel {
  id: string;
  gameId: string;
  levelNum: number;
  title?: string;
  assetUrl: string;
  difficulty: 1 | 2 | 3;
  timeLimit?: number;
  config?: Record<string, unknown>;
}

export interface Game extends Timestamps {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  gradeLevels?: string[];
  thumbnailUrl?: string;
  tags?: string[];
  status: GameStatus;
  levelCount: number;
}

export interface GameLevelResult {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  highScore: number;
  attempts: number;
  bestTimeSeconds?: number;
  lastPlayedAt?: string;
}

export interface GameProgress {
  studentId: string;
  gameId: string;
  currentLevel: number;
  totalScore: number;
  levelsData: Record<number, GameLevelResult>;
}

// ─── AI ──────────────────────────────────────────────────────

export interface AiJob extends Timestamps {
  id: string;
  schoolId: string;
  teacherId?: string;
  type: AiJobType;
  status: AiJobStatus;
  result?: unknown;
  tokensUsed?: number;
  qualityScore?: number;
  completedAt?: string;
}

// ─── Notification ─────────────────────────────────────────────

export interface Notification extends Timestamps {
  id: string;
  userId: string;
  schoolId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read: boolean;
}

// ─── Analytics ───────────────────────────────────────────────

export interface StudentStats {
  userId: string;
  totalXp: number;
  level: number;
  streak: number;
  lessonsCompleted: number;
  gamesPlayed: number;
  practiceAttempts: number;
  avgPracticeScore: number;
  lastActiveAt?: string;
}

// ─── Gamification ─────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  condition: string;
}

export interface StudentBadge {
  badge: Badge;
  earnedAt: string;
}
