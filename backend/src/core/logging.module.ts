import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service.js';

/**
 * Global Core module exposing `LoggerService` to every other module without
 * requiring an explicit `imports` entry — mirrors the `JwtModule`
 * `{ global: true }` pattern already used in `app.module.ts` (statically
 * declared modules mark themselves global via `@Global()` rather than a
 * `global` option in `@Module()`, which only applies to dynamic modules).
 * Any consumer (`MailModule`, `AuthModule`, a future request-logging
 * interceptor) injects `LoggerService` in its constructor with zero import
 * changes of its own.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule {}
