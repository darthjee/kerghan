import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service.js';
import { RequestContextService } from './request-context.service.js';

/**
 * Global Core module exposing `LoggerService` and `RequestContextService` to
 * every other module without requiring an explicit `imports` entry — mirrors
 * the `JwtModule` `{ global: true }` pattern already used in `app.module.ts`
 * (statically declared modules mark themselves global via `@Global()` rather
 * than a `global` option in `@Module()`, which only applies to dynamic
 * modules). Any consumer (`MailModule`, `AuthModule`, a future
 * request-logging interceptor) injects `LoggerService` in its constructor
 * with zero import changes of its own. `RequestContextService` holds the
 * per-request correlation store that makes `LoggerService` context-aware.
 */
@Global()
@Module({
  providers: [LoggerService, RequestContextService],
  exports: [LoggerService, RequestContextService],
})
export class LoggingModule {}
