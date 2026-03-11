import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  Lesson,
  Game,
  User,
  School,
  PaginatedResponse,
  LessonProgress,
  GameProgress,
  AiJob,
  Notification,
  StudentStats,
} from '@platform/types';

// ─── Token store (in-memory, replaced by Zustand in apps) ────

let _accessToken: string | null = null;
let _refreshCallback: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) { _accessToken = token; }
export function setRefreshCallback(fn: () => Promise<string | null>) { _refreshCallback = fn; }

// ─── Client Factory ───────────────────────────────────────────

export function createApiClient(config: {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  onRefresh?: () => Promise<string | null>;
}): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // Send refresh token cookie
  });

  // Attach token to every request
  client.interceptors.request.use((req) => {
    const token = config.getToken();
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  // Auto-refresh on 401
  let isRefreshing = false;
  let refreshQueue: Array<(token: string | null) => void> = [];

  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as typeof error.config & { _retry?: boolean };
      if (error.response?.status === 401 && !original?._retry) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            refreshQueue.push((token) => {
              if (original && token) {
                original.headers = original.headers ?? {};
                original.headers.Authorization = `Bearer ${token}`;
                resolve(client(original));
              }
            });
          });
        }

        original!._retry = true;
        isRefreshing = true;

        try {
          const newToken = config.onRefresh ? await config.onRefresh() : null;
          if (newToken) {
            refreshQueue.forEach((cb) => cb(newToken));
            refreshQueue = [];
            original!.headers = original!.headers ?? {};
            original!.headers.Authorization = `Bearer ${newToken}`;
            return client(original!);
          }
        } catch (_) {
          refreshQueue = [];
        } finally {
          isRefreshing = false;
        }

        config.onUnauthorized?.();
      }
      return Promise.reject(error);
    },
  );

  return client;
}

// ─── Lessons API ─────────────────────────────────────────────

export function createLessonsApi(client: AxiosInstance) {
  return {
    list: (params?: Record<string, unknown>) =>
      client.get<PaginatedResponse<Lesson>>('/lessons', { params }).then((r) => r.data),

    getById: (id: string) =>
      client.get<Lesson>(`/lessons/${id}`).then((r) => r.data),

    create: (data: Partial<Lesson>) =>
      client.post<Lesson>('/lessons', data).then((r) => r.data),

    update: (id: string, data: Partial<Lesson>) =>
      client.patch<Lesson>(`/lessons/${id}`, data).then((r) => r.data),

    delete: (id: string) =>
      client.delete(`/lessons/${id}`),

    assign: (id: string, data: { classroomIds: string[]; dueDate?: string }) =>
      client.post(`/lessons/${id}/assign`, data).then((r) => r.data),

    markComplete: (id: string) =>
      client.post<LessonProgress>(`/lessons/${id}/complete`).then((r) => r.data),

    getProgress: (id: string) =>
      client.get<LessonProgress[]>(`/lessons/${id}/progress`).then((r) => r.data),

    generate: (data: { topic: string; subject: string; gradeLevel: string; language: string }) =>
      client.post<AiJob>('/lessons/generate', data).then((r) => r.data),
  };
}

// ─── Games API ───────────────────────────────────────────────

export function createGamesApi(client: AxiosInstance) {
  return {
    list: (params?: Record<string, unknown>) =>
      client.get<PaginatedResponse<Game>>('/games', { params }).then((r) => r.data),

    getById: (id: string) =>
      client.get<Game>(`/games/${id}`).then((r) => r.data),

    getProgress: (gameId: string) =>
      client.get<GameProgress>(`/games/${gameId}/progress`).then((r) => r.data),

    saveProgress: (gameId: string, levelNum: number, result: Record<string, unknown>) =>
      client.post(`/games/${gameId}/progress`, { levelNum, result }).then((r) => r.data),

    getLeaderboard: (gameId: string) =>
      client.get(`/games/${gameId}/leaderboard`).then((r) => r.data),

    assign: (gameId: string, data: { classroomIds: string[]; minLevel?: number; dueDate?: string }) =>
      client.post(`/games/${gameId}/assign`, data).then((r) => r.data),
  };
}

// ─── Users API ───────────────────────────────────────────────

export function createUsersApi(client: AxiosInstance) {
  return {
    me: () => client.get<User>('/users/me').then((r) => r.data),

    getById: (id: string) => client.get<User>(`/users/${id}`).then((r) => r.data),

    update: (id: string, data: Partial<User>) =>
      client.patch<User>(`/users/${id}`, data).then((r) => r.data),

    list: (params?: Record<string, unknown>) =>
      client.get<PaginatedResponse<User>>('/users', { params }).then((r) => r.data),

    getStats: (id: string) =>
      client.get<StudentStats>(`/analytics/student/${id}`).then((r) => r.data),
  };
}

// ─── Schools API ─────────────────────────────────────────────

export function createSchoolsApi(client: AxiosInstance) {
  return {
    getById: (id: string) => client.get<School>(`/schools/${id}`).then((r) => r.data),

    update: (id: string, data: Partial<School>) =>
      client.patch<School>(`/schools/${id}`, data).then((r) => r.data),

    updateBranding: (id: string, data: School['branding']) =>
      client.patch(`/schools/${id}/branding`, data).then((r) => r.data),
  };
}

// ─── Auth API ────────────────────────────────────────────────

export function createAuthApi(client: AxiosInstance) {
  return {
    login: (email: string, password: string) =>
      client.post<{ accessToken: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),

    logout: () => client.post('/auth/logout'),

    refresh: () =>
      client.post<{ accessToken: string }>('/auth/refresh').then((r) => r.data),

    forgotPassword: (email: string) =>
      client.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, password: string) =>
      client.post('/auth/reset-password', { token, password }),
  };
}

// ─── Notifications API ───────────────────────────────────────

export function createNotificationsApi(client: AxiosInstance) {
  return {
    list: () =>
      client.get<PaginatedResponse<Notification>>('/notifications').then((r) => r.data),

    markRead: (id: string) =>
      client.patch(`/notifications/${id}/read`),

    markAllRead: () =>
      client.patch('/notifications/read-all'),
  };
}

// ─── Unified Platform API Client ─────────────────────────────

export class PlatformApiClient {
  public readonly auth: ReturnType<typeof createAuthApi>;
  public readonly lessons: ReturnType<typeof createLessonsApi>;
  public readonly games: ReturnType<typeof createGamesApi>;
  public readonly users: ReturnType<typeof createUsersApi>;
  public readonly schools: ReturnType<typeof createSchoolsApi>;
  public readonly notifications: ReturnType<typeof createNotificationsApi>;

  constructor(config: { baseUrl: string; getToken: () => string | null; onUnauthorized?: () => void }) {
    const client = createApiClient(config);
    this.auth = createAuthApi(client);
    this.lessons = createLessonsApi(client);
    this.games = createGamesApi(client);
    this.users = createUsersApi(client);
    this.schools = createSchoolsApi(client);
    this.notifications = createNotificationsApi(client);
  }
}

export default PlatformApiClient;
