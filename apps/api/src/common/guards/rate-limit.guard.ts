import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

interface ClientRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly hits = new Map<string, ClientRecord>();

  // Default global limits: 120 requests per 60 seconds
  private readonly defaultLimit = 120;
  private readonly defaultTtlSeconds = 60;

  constructor(private reflector: Reflector) {
    // Cleanup expired records every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000).unref();
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // Skip rate-limiting for health checks
    if (req.path === '/health' || req.path === '/health/ready') {
      return true;
    }

    // Determine custom rate limits from decorator (handler > class > default)
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || { limit: this.defaultLimit, ttlSeconds: this.defaultTtlSeconds };

    const ip = this.getClientIp(req);
    const key = `${ip}:${req.baseUrl || ''}${req.path || ''}`;
    const now = Date.now();
    const windowMs = options.ttlSeconds * 1000;

    let record = this.hits.get(key);

    if (!record || now >= record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, options.limit - record.count);
    const resetTimeSec = Math.ceil((record.resetAt - now) / 1000);

    // Standard rate limit response headers (RFC 6585)
    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSec);

    if (record.count > options.limit) {
      this.logger.warn(`🛑 Rate limit exceeded for IP: ${ip} on ${req.method} ${req.path}`);
      res.setHeader('Retry-After', resetTimeSec);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many requests from this IP. Please try again in ${resetTimeSec} seconds.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now >= record.resetAt) {
        this.hits.delete(key);
      }
    }
  }
}
