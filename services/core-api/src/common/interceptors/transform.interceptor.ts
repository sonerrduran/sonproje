import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response already has a `data` key and an error key, pass through
        if (data && typeof data === 'object' && 'error' in (data as object)) {
          return data as unknown as StandardResponse<T>;
        }
        return {
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
