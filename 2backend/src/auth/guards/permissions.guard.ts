import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route has no @Permissions() → allow
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest() as {
      user: { roles?: string[]; role?: string };
    };
    const userRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);

    // ADMIN bypasses all permission checks
    if (userRoles.includes('ADMIN')) return true;

    // TODO STEP 2: load Role → Permission mappings from DB and check `required` keys
    // For now, block non-admins if a @Permissions() guard is present
    throw new ForbiddenException('Insufficient permissions.');
  }
}
