import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Use on any controller that owns tenant-scoped resources.
// It ensures the :schoolId route param (or query param) matches the authenticated user's schoolId.

export const TENANT_CHECK_KEY = 'tenantCheck';

/** Apply this to controllers/handlers to enforce tenant isolation from route params */
export const TenantResource = () =>
  (target: object, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(TENANT_CHECK_KEY, true, descriptor.value as object);
    } else {
      Reflect.defineMetadata(TENANT_CHECK_KEY, true, target);
    }
    return descriptor;
  };

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if tenant enforcement is enabled on this handler
    const requiresTenantCheck = this.reflector.getAllAndOverride<boolean>(
      TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Super admins bypass tenant checks
    const req = context.switchToHttp().getRequest<{
      user: { schoolId: string; role: string };
      params: Record<string, string>;
      query: Record<string, string>;
    }>();

    if (!req.user) return true; // Let JwtAuthGuard handle unauthenticated requests

    if (req.user.role === 'SUPER_ADMIN') return true;

    if (requiresTenantCheck) {
      // Check route param :schoolId or query param schoolId
      const routeSchoolId = req.params['schoolId'] ?? req.query['schoolId'];
      if (routeSchoolId && routeSchoolId !== req.user.schoolId) {
        throw new ForbiddenException(
          'You do not have access to resources belonging to another school',
        );
      }
    }

    return true;
  }
}
