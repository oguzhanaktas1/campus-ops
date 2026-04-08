import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest() as {
      user: { roles?: string[]; role?: string };
    };

    // Support both roles[] (new) and role string (old tokens still in circulation)
    const userRoles: string[] =
      user?.roles ??
      (user?.role ? [user.role.toUpperCase()] : []);

    const hasRole = required.some((r) => userRoles.includes(r.toUpperCase()));

    if (!hasRole) {
      throw new ForbiddenException('Bu işleme yetkiniz yok.');
    }

    return true;
  }
}
