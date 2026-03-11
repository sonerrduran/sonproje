import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  status: number;
  title: string;
  detail?: string;
  timestamp: string;
  path: string;
  traceId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;

    const detail =
      typeof raw === 'object' && raw !== null && 'message' in raw
        ? Array.isArray((raw as Record<string, unknown>).message)
          ? ((raw as Record<string, unknown>).message as string[]).join('; ')
          : String((raw as Record<string, unknown>).message)
        : exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred';

    const title = this.getTitle(status);
    const traceId = req.headers['x-trace-id'] as string | undefined;

    const body: ErrorResponse = {
      status,
      title,
      detail,
      path: req.url,
      timestamp: new Date().toISOString(),
      traceId,
    };

    if (status >= 500) {
      this.logger.error(`[${status}] ${req.method} ${req.url} — ${detail}`, {
        traceId,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn(`[${status}] ${req.method} ${req.url} — ${detail}`);
    }

    res.status(status).json({ error: body });
  }

  private getTitle(status: number): string {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    return titles[status] ?? 'Error';
  }
}
