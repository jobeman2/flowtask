import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const { method, originalUrl, ip } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse();
          const statusCode = res.statusCode;
          const delay = Date.now() - now;
          this.logger.log(
            `[${method}] ${originalUrl} ${statusCode} - ${delay}ms [IP: ${ip}]`
          );
        },
        error: (err) => {
          const delay = Date.now() - now;
          this.logger.error(
            `[${method}] ${originalUrl} failed - ${delay}ms [Error: ${err.message}]`
          );
        },
      })
    );
  }
}
