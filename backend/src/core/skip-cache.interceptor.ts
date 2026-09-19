import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { IS_SKIP_CACHE_KEY } from './skip-cache.decorator.js';
import { SKIP_CACHE_HEADER } from '../auth/auth-response.js';

/**
 * Global interceptor setting the `X-Skip-Cache` response header on routes
 * (or controllers) annotated with `@SkipCache()`, independent of any
 * feature module (per the issue's "Core" module classification). Routes
 * without `@SkipCache()` metadata are unaffected (no-op) — safe to register
 * globally alongside `JwtGuard`/`AdminGuard`.
 */
@Injectable()
export class SkipCacheInterceptor implements NestInterceptor {
  private readonly reflector: Reflector;

  /**
   * @param {Reflector} reflector - Reads the `@SkipCache()` route metadata.
   */
  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  /**
   * Sets `X-Skip-Cache` on the response before delegating to the route
   * handler when the route (or its controller) carries `@SkipCache()`
   * metadata; otherwise passes the request through untouched.
   * @param {ExecutionContext} context - The current request's execution context.
   * @param {CallHandler} next - Delegates to the remaining handler chain.
   * @returns {Observable<unknown>} The unmodified response stream.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.#isSkipCache(context)) {
      const response = context.switchToHttp().getResponse<Response>();
      response.set(SKIP_CACHE_HEADER, 'true');
    }

    return next.handle();
  }

  #isSkipCache(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(IS_SKIP_CACHE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }
}
