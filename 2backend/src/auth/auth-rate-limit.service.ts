import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.tokens';

@Injectable()
export class AuthRateLimitService {
  private readonly windowSeconds = 15 * 60;
  private readonly maxAttempts = 5;
  private readonly blockSeconds = 15 * 60;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async assertAllowed(key: string): Promise<void> {
    let ttl: number;
    try {
      ttl = await this.redis.ttl(`rl:auth:block:${key}`);
    } catch {
      return;
    }
    if (ttl > 0) {
      throw new HttpException(
        `Çok fazla giriş denemesi. ${ttl} saniye sonra tekrar deneyin.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(key: string): Promise<void> {
    try {
      const failKey = `rl:auth:fail:${key}`;
      const count = await this.redis.incr(failKey);
      if (count === 1) {
        await this.redis.expire(failKey, this.windowSeconds);
      }
      if (count >= this.maxAttempts) {
        await this.redis.set(
          `rl:auth:block:${key}`,
          '1',
          'EX',
          this.blockSeconds,
        );
      }
    } catch {
      // Redis unavailable — skip tracking to avoid breaking auth flow
    }
  }

  async clear(key: string): Promise<void> {
    try {
      await this.redis.del(`rl:auth:fail:${key}`, `rl:auth:block:${key}`);
    } catch {
      // ignore
    }
  }
}
