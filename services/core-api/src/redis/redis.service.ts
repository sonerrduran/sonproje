import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // ─── Core helpers ─────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrby(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // ─── Pattern-based operations ─────────────────────────────

  async scanDel(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length) await this.client.del(...keys);
    } while (cursor !== '0');
  }

  // ─── Leaderboard (Sorted Set) ─────────────────────────────

  async zAdd(key: string, score: number, member: string, ttlSeconds?: number): Promise<void> {
    await this.client.zadd(key, score, member);
    if (ttlSeconds) await this.client.expire(key, ttlSeconds);
  }

  async zRank(key: string, member: string): Promise<number | null> {
    const rank = await this.client.zrevrank(key, member); // descending
    return rank;
  }

  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop, 'WITHSCORES');
  }

  // ─── Pub/Sub ──────────────────────────────────────────────

  getClient(): Redis {
    return this.client;
  }
}
