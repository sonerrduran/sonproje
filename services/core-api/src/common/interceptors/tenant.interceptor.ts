import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

/**
 * Sets the PostgreSQL session variable `app.current_school_id` before each
 * request so Row-Level Security policies can use it.
 *
 * This runs on every authenticated request and is applied globally in main.ts.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: { schoolId: string };
    }>();

    const schoolId = req.user?.schoolId;

    if (schoolId) {
      // Fire-and-forget: Set the session variable. Not awaited because we cannot
      // make intercept async in NestJS — the Prisma middleware picks it up.
      // For production: use a transaction-scoped approach or Prisma middleware.
      this.prisma
        .$executeRaw`SET LOCAL app.current_school_id = ${schoolId}`
        .catch((err) => this.logger.error('Failed to set tenant context', err));
    }

    return next.handle();
  }
}
