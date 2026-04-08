import { UnauthorizedException } from '@nestjs/common';

type AuthUserLike = {
  id?: string;
  userId?: string;
  sub?: string;
};

type RequestLike = {
  user?: AuthUserLike;
};

export function extractUserId(req: RequestLike): string {
  const id = req.user?.userId || req.user?.id || req.user?.sub;
  if (!id) {
    throw new UnauthorizedException('Kimlik doğrulanamadı.');
  }
  return id;
}
