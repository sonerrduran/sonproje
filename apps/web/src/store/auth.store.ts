import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlatformApiClient } from '@galactic/api-client';

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  schoolId: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  setUser: (user: AuthUser) => void;
}

// Single API client instance shared across the app
let apiInstance: PlatformApiClient | null = null;

export function getApiClient(): PlatformApiClient {
  if (!apiInstance) {
    apiInstance = new PlatformApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
      getToken: () => useAuthStore.getState().accessToken,
      onUnauthorized: () => useAuthStore.getState().logout(),
      onRefresh: () => useAuthStore.getState().refreshToken(),
    });
  }
  return apiInstance;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const api = getApiClient();
          const { accessToken, user } = await api.auth.login(email, password);
          set({
            accessToken,
            user: user as AuthUser,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await getApiClient().auth.logout();
        } catch { /* ignore */ }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      refreshToken: async () => {
        try {
          const api = getApiClient();
          const { accessToken } = await api.auth.refresh();
          set({ accessToken });
          return accessToken;
        } catch {
          set({ user: null, accessToken: null, isAuthenticated: false });
          return null;
        }
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'galactic-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    },
  ),
);
