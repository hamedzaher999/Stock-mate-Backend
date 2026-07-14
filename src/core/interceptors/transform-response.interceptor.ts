import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

interface ShapedResult {
  message?: string;
  data?: unknown;
}

function isShapedResult(value: unknown): value is ShapedResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('message' in value || 'data' in value)
  );
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse> {
    return next.handle().pipe(
      map((result: unknown): ApiResponse => {
        if (isShapedResult(result)) {
          return {
            success: true,
            message: result.message ?? 'Success',
            data: result.data ?? null,
          };
        }

        return {
          success: true,
          message: 'Success',
          data: result ?? null,
        };
      }),
    );
  }
}
