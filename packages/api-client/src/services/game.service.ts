import { ApiClient } from '../client';
import type { GameFilters, GameSession, CreateSessionDto, CompleteSessionDto } from '@platform/types';

export class GameService {
  constructor(private client: ApiClient) {}

  async getCategories(): Promise<any[]> {
    return this.client.get('/games/categories');
  }

  async getCategoryById(id: string): Promise<any> {
    return this.client.get(`/games/categories/${id}`);
  }

  async getGames(filters?: GameFilters): Promise<any[]> {
    return this.client.get('/games', filters);
  }

  async getGame(id: string): Promise<any> {
    return this.client.get(`/games/${id}`);
  }

  async getContent(id: string, type?: string): Promise<any> {
    return this.client.get(`/games/${id}/content`, { type });
  }

  async play(id: string): Promise<GameSession> {
    return this.client.post(`/games/${id}/play`, {});
  }

  async createSession(data: CreateSessionDto): Promise<GameSession> {
    return this.client.post('/sessions', data);
  }

  async completeSession(data: CompleteSessionDto): Promise<void> {
    return this.client.post('/sessions/complete', data);
  }
}
