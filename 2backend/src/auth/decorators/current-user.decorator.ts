import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() → req.user (full object)
 * @CurrentUser('userId') → req.user.userId
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as Record<string, unknown>;
    return data ? user?.[data] : user;
  },
);
