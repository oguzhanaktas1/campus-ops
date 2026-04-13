import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
};

@Injectable()
export class AuthRateLimitService {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxAttempts = 5;
  private readonly blockMs = 15 * 60 * 1000;

  assertAllowed(key: string) {
    const record = this.attempts.get(key);
    const now = Date.now();

    if (!record) return;

    if (record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      throw new HttpException(
        `Too many authentication attempts. Retry in ${retryAfterSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - record.firstAttemptAt > this.windowMs) {
      this.attempts.delete(key);
    }
  }

  recordFailure(key: string) {
    const now = Date.now();
    const existing = this.attempts.get(key);

    if (!existing || now - existing.firstAttemptAt > this.windowMs) {
      this.attempts.set(key, {
        count: 1,
        firstAttemptAt: now,
        blockedUntil: 0,
      });
      return;
    }

    const nextCount = existing.count + 1;
    this.attempts.set(key, {
      count: nextCount,
      firstAttemptAt: existing.firstAttemptAt,
      blockedUntil:
        nextCount >= this.maxAttempts ? now + this.blockMs : existing.blockedUntil,
    });
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
