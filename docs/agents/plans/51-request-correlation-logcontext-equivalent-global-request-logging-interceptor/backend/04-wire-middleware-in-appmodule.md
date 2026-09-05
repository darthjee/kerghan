# Wire the middleware into AppModule

Register `RequestContextMiddleware` globally so it covers every current and future route
with no per-controller code.

## Changes (`backend/src/app.module.ts`)

- `import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';`
- `import { RequestContextMiddleware } from './core/request-context.middleware.js';`
- Declare the class as `export class AppModule implements NestModule` and add:

  ```ts
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
  ```

- Because `AppModule` already imports `LoggingModule` (`@Global()`), which now provides
  `RequestContextService`, the middleware's dependencies resolve. Add
  `RequestContextMiddleware` itself to `LoggingModule`'s `providers` **and** `exports` (in
  step 01's file) so `AppModule.configure` can apply it — a middleware applied in a module
  must be provided by that module or one it imports.
  - Adjust: fold this `providers`/`exports` addition for `RequestContextMiddleware` into
    step 01's `logging.module.ts` edit, or add it here — either way `logging.module.ts` ends
    up exporting `RequestContextService` **and** `RequestContextMiddleware`.
- The existing
  `// eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment above
  `AppModule` must be **removed** — the class is no longer extraneous once it has a
  `configure` method.
- JSDoc: extend the `AppModule` class doc to note it now wires the global
  request-context/access-log middleware ahead of the `APP_GUARD` chain.
- `main.ts` needs **no change** — middleware registered via `configure()` is applied by Nest
  during `app.init()`.

## Ordering guarantee to preserve

Nest runs middleware before guards. `RequestContextMiddleware` therefore establishes the ALS
context before `JwtGuard` / `AdminGuard` run, and its `res.on('finish')` listener still fires
when a guard throws 401/403. Do not move this logic into an `APP_INTERCEPTOR` — interceptors
run after guards and would miss guard-rejected requests.

## Files to Change

- `backend/src/app.module.ts` — implement `NestModule`; `configure()` applies
  `RequestContextMiddleware` to `forRoutes('*')`; drop the now-stale
  `no-extraneous-class` eslint-disable; extend the class JSDoc.
- `backend/src/core/logging.module.ts` — ensure `RequestContextMiddleware` is in `providers`
  and `exports` (alongside `RequestContextService` from step 01).
