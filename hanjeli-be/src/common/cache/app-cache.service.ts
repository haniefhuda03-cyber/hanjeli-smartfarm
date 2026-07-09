import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  getRedisConfig,
  RedisRuntimeConfig,
} from '../../config/redis.config.js';

interface MemoryEntry {
  expiresAt: number;
  value: unknown;
}

@Injectable()
export class AppCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly config: RedisRuntimeConfig;
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  constructor(configService: ConfigService) {
    this.config = getRedisConfig(configService);
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) return;

    this.redis = this.config.url
      ? new Redis(this.config.url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });

    this.redis.on('error', (error) => {
      this.logger.warn(`Redis cache unavailable: ${error.message}`);
    });

    await this.redis.connect().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache connect skipped: ${message}`);
      this.redis = null;
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const normalizedKey = this.normalizeKey(key);

    const redisValue = await this.getRedis<T>(normalizedKey);
    if (redisValue !== null) return redisValue;

    const memoryValue = this.memory.get(normalizedKey);
    if (!memoryValue) return null;
    if (memoryValue.expiresAt <= Date.now()) {
      this.memory.delete(normalizedKey);
      return null;
    }

    return memoryValue.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    const normalizedKey = this.normalizeKey(key);
    this.memory.set(normalizedKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (!this.redis) return;

    await this.redis
      .set(normalizedKey, JSON.stringify(value), 'EX', ttlSeconds)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Redis cache write skipped: ${message}`);
      });
  }

  async del(patternOrKey: string): Promise<void> {
    const normalized = this.normalizeKey(patternOrKey);

    if (normalized.includes('*')) {
      await this.deletePattern(normalized);
      return;
    }

    this.memory.delete(normalized);
    if (this.redis) {
      await this.redis.del(normalized).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Redis cache delete skipped: ${message}`);
      });
    }
  }

  async invalidate(patterns: string[]): Promise<void> {
    await Promise.all(patterns.map((pattern) => this.del(pattern)));
  }

  normalizeKey(key: string): string {
    const clean = key.replace(/^hanjeli:/, '').replace(/^:/, '');
    return `${this.config.keyPrefix}:${clean}`;
  }

  private async getRedis<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache read skipped: ${message}`);
      return null;
    }
  }

  private async deletePattern(pattern: string): Promise<void> {
    const regex = this.globToRegex(pattern);
    for (const key of Array.from(this.memory.keys())) {
      if (regex.test(key)) {
        this.memory.delete(key);
      }
    }

    if (!this.redis) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache pattern delete skipped: ${message}`);
    }
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
  }
}
