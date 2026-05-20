import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { THROTTLE_KEY, ThrottleConfig } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<ThrottleConfig>(
      THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!config) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();

    let result: Awaited<ReturnType<RateLimitService['check']>>;
    try {
      const identifier = this.resolveIdentifier(config.keyType ?? 'user', req);
      const key = `rl:${config.namespace}:${identifier}`;
      result = await this.rateLimitService.check(
        key,
        config.limit,
        config.windowSeconds,
      );
    } catch {
      // Redis unavailable — fail open to avoid blocking legitimate traffic
      return true;
    }

    res.setHeader('X-RateLimit-Limit', config.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetIn);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Çok fazla istek gönderildi. Lütfen bekleyin.',
          retryAfter: result.resetIn,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveIdentifier(
    keyType: 'ip' | 'user' | 'ip+user',
    req: Request & { user?: { userId?: string } },
  ): string {
    const ip = this.getIp(req);
    const userId = req.user?.userId ?? 'anon';
    switch (keyType) {
      case 'ip':
        return ip;
      case 'user':
        return userId;
      case 'ip+user':
        return `${ip}:${userId}`;
    }
  }

  private getIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim();
    }
    return (req as any).ip ?? 'unknown';
  }
}
