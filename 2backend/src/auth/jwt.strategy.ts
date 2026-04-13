import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_COOKIE_NAME } from './auth-cookie';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[]; // e.g. ['STUDENT'], ['ADMIN']
}

/** Decoded shape attached to req.user after JWT validation */
export interface JwtUser {
  userId: string;
  email: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret =
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('JWT_SECRET must be configured in production.');
          })()
        : 'dev-only-insecure-secret-change-me');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request | undefined) => {
          const cookieHeader = request?.headers?.cookie;
          if (!cookieHeader) return null;

          const parts = cookieHeader.split(';');
          for (const part of parts) {
            const [rawName, ...valueParts] = part.trim().split('=');
            if (rawName === AUTH_COOKIE_NAME) {
              return decodeURIComponent(valueParts.join('='));
            }
          }

          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload): JwtUser {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
