// Authentication and User Types

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  gradeLevel: number;
  stars: number;
  xp: number;
  level: number;
  avatar: string;
  solvedProblems: number;
  streakDays: number;
  schoolId?: string | null;
  school?: { id: string; name: string; code?: string } | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: string;
  gradeLevel?: number;
  schoolCode?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}
