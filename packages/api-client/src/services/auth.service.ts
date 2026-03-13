import { ApiClient } from '../client';
import type { LoginCredentials, RegisterData, AuthResponse, AuthUser } from '@platform/types';

export class AuthService {
  constructor(private client: ApiClient) {}

  async register(data: RegisterData): Promise<AuthResponse> {
    return this.client.post('/auth/register', data);
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.client.post('/auth/login', credentials);
  }

  async getMe(): Promise<AuthUser> {
    return this.client.get('/auth/me');
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return this.client.post('/auth/refresh', { refreshToken });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    return this.client.put('/auth/change-password', data);
  }
}
