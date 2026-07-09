import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createHash } from 'node:crypto';
import { Observable, from, of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { AppCacheService } from '../cache/app-cache.service.js';
import {
  CACHE_INVALIDATE_METADATA,
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache.decorator.js';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    role?: string;
  };
};

@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: AppCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const ttl = this.reflector.getAllAndOverride<number>(CACHE_TTL_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (request.method === 'GET' && ttl) {
      return from(this.handleGetCache(context, request, next, ttl));
    }

    const invalidationPatterns = this.reflector.getAllAndOverride<string[]>(
      CACHE_INVALIDATE_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!invalidationPatterns?.length) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void this.cache.invalidate(
          invalidationPatterns.map((pattern) =>
            this.interpolate(pattern, request),
          ),
        );
      }),
    );
  }

  private async handleGetCache(
    context: ExecutionContext,
    request: RequestWithUser,
    next: CallHandler,
    ttl: number,
  ): Promise<unknown> {
    const key = this.buildKey(context, request);
    const cached = await this.cache.get<unknown>(key);
    if (cached !== null) return cached;

    return new Promise((resolve, reject) => {
      next
        .handle()
        .pipe(
          mergeMap((value) =>
            from(this.cache.set(key, value, ttl)).pipe(
              mergeMap(() => of(value)),
            ),
          ),
        )
        .subscribe({
          next: resolve,
          error: reject,
        });
    });
  }

  private buildKey(
    context: ExecutionContext,
    request: RequestWithUser,
  ): string {
    const explicitKey = this.reflector.getAllAndOverride<string>(
      CACHE_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (explicitKey) {
      return this.interpolate(explicitKey, request);
    }

    const userId = request.user?.id ?? 'public';
    const queryHash = createHash('sha1')
      .update(request.originalUrl ?? request.url)
      .digest('hex')
      .slice(0, 16);

    return `http:${request.route?.path ?? request.path}:user:${userId}:${queryHash}`;
  }

  private interpolate(pattern: string, request: RequestWithUser): string {
    const userId = request.user?.id ?? 'public';
    const hash = createHash('sha1')
      .update(request.originalUrl ?? request.url)
      .digest('hex')
      .slice(0, 16);

    return pattern
      .replace(/\{userId\}/g, userId)
      .replace(/\{hash\}/g, hash)
      .replace(/\{path\}/g, request.path)
      .replace(/\{method\}/g, request.method.toLowerCase());
  }
}
