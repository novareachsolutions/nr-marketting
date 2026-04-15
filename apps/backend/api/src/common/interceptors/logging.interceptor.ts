import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { method, originalUrl, ip } = req;
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    this.logger.log(
      `→ ${method} ${originalUrl} • ${controller}.${handler} • ip=${ip} • ua="${userAgent}"`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            `← ${method} ${originalUrl} ${res.statusCode} • ${controller}.${handler} • ${ms}ms`,
          );
        },
        error: (err: Error & { status?: number }) => {
          const ms = Date.now() - start;
          this.logger.error(
            `✗ ${method} ${originalUrl} ${err.status ?? 500} • ${controller}.${handler} • ${ms}ms • ${err.message}`,
          );
        },
      }),
    );
  }
}
