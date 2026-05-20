import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = Symbol('throttle');

export interface ThrottleConfig {
  limit: number;
  windowSeconds: number;
  keyType?: 'ip' | 'user' | 'ip+user';
  namespace: string;
}

export const Throttle = (config: ThrottleConfig) =>
  SetMetadata(THROTTLE_KEY, config);
