import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.tokens';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      this.logger.log('Redis cache connected.');
    } catch (error) {
      this.logger.error(`Redis connection failed: ${String(error)}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Failed to parse cache value for key: ${key}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    const next = await this.redis.decr(key);
    if (next < 0) {
      await this.redis.set(key, '0');
      return 0;
    }
    return next;
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // Fetches version + cached value in a single Lua round-trip instead of two sequential GETs.
  async getWithVersion<T>(
    versionNamespace: string,
    baseKey: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const lua = `
      local ver = redis.call('GET', KEYS[1])
      if not ver then ver = '1' end
      local fullKey = KEYS[2] .. ':v' .. ver
      local data = redis.call('GET', fullKey)
      return {ver, data, fullKey}
    `;
    const result = (await this.redis.eval(
      lua,
      2,
      `version:${versionNamespace}`,
      baseKey,
    )) as [string, string | null, string];

    const [, raw, cacheKey] = result;

    if (raw !== null && raw !== undefined) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        this.logger.warn(`Cache parse error for key: ${cacheKey}`);
      }
    }

    const value = await factory();
    await this.redis.set(cacheKey, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  async getVersion(namespace: string): Promise<number> {
    const value = await this.redis.get(`version:${namespace}`);
    return value ? Number(value) : 1;
  }

  async bumpVersion(namespace: string): Promise<number> {
    const key = `version:${namespace}`;
    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.set(key, '1');
    }
    const next = await this.redis.incr(key);
    await this.redis.expire(key, 60 * 60 * 24 * 30);
    return next;
  }

  async getVersionedKey(namespace: string, baseKey: string): Promise<string> {
    const version = await this.getVersion(namespace);
    return `${baseKey}:v${version}`;
  }
}
