import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/** Injects the full authenticated user object into a route parameter */
export const CurrentUser = createParamDecorator(
  (_data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;
    return _data ? user?.[_data] : user;
  },
);

/** Injects just the school_id from the authenticated JWT payload */
export const CurrentSchool = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: { schoolId: string } }>();
    return request.user?.schoolId;
  },
);
