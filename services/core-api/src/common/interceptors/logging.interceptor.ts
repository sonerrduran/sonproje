import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const start = Date.now();
    const traceId = (req.headers['x-trace-id'] as string) ?? crypto.randomUUID();
    req.headers['x-trace-id'] = traceId;
    res.setHeader('x-trace-id', traceId);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} ${res.statusCode} +${ms}ms [${traceId}]`);
        },
        error: () => {
          const ms = Date.now() - start;
          this.logger.warn(`${method} ${url} ERROR +${ms}ms [${traceId}]`);
        },
      }),
    );
  }
}
