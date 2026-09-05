# Backend Plan: Request correlation: LogContext-equivalent + global request-logging interceptor

Main plan: [plan.md](plan.md)

## Overview

Build request correlation as Core-layer infrastructure (`backend/src/core/`), consuming the
`LoggerService` shipped in #50:

1. `RequestContextService` — an injectable wrapper around a single
   `AsyncLocalStorage<{ requestId: string }>` instance (module-level global state stays
   encapsulated in a provider, per the project's DI-only rule).
2. `LoggerService` becomes context-aware — when a request context is active, every
   `debug/info/warn/error` call merges the bound `{ requestId }` in; explicit per-call
   `attributes` win on key collision. Downstream sub-issues (3-5) keep injecting
   `LoggerService` unchanged and get correlated log lines for free.
3. `LogContext` — a small explicit-binding wrapper (`new LogContext(logger, { requestId })`)
   exposing the same method surface, merging its bound attributes into every call. This is
   the literal `LogContext`-equivalent the issue's acceptance criteria call for; it is not
   the required path for sub-issues 3-5 (the context-aware `LoggerService` is).
4. `RequestContextMiddleware` — a global Nest middleware that mints a UUID v4 `requestId`
   (`randomUUID` from `node:crypto`, the established pattern in `auth.service.ts` /
   `cache-token.service.ts`), runs the rest of the request inside
   `RequestContextService.run(requestId, next)`, and registers `res.on('finish')` to emit
   one `info` line `('request', { method, path, statusCode, requestId })`. `requestId` is
   passed explicitly into that call (not relied on via ALS) so the access-log line is robust
   regardless of async-context propagation into the `finish` listener.
5. Wire it in `AppModule` via `NestModule#configure(consumer)` →
   `consumer.apply(RequestContextMiddleware).forRoutes('*')`. Nest middleware runs before
   guards, so the ALS context is set before `JwtGuard` / `AdminGuard` execute and the
   `finish` listener still fires for guard-rejected 401 / 403 responses.

### Why middleware + `AsyncLocalStorage`, not a request-scoped provider

A `REQUEST`-scoped provider is transitively viral in Nest DI (every consumer becomes
request-scoped, a fresh injector subtree per request) and would force `LoggerService` —
injected widely — out of singleton scope. ALS keeps `LoggerService` a plain singleton and
composes cleanly with the existing `APP_GUARD` registration order in `app.module.ts`.

## Shared contracts

No cross-agent contract — single-agent (`backend`) plan. Internal contract for the
downstream logging sub-issues (#49 sub-issues 3-5):

- `RequestContextService` (exported from `LoggingModule`, `@Global()`):
  - `run<T>(requestId: string, callback: () => T): T`
  - `getRequestId(): string | undefined`
- `LoggerService` (unchanged public surface): `debug/info/warn/error(message: string,
  attributes?: Record<string, unknown>): void`. When a request context is active, each call
  is emitted with `{ ...boundContext, ...attributes }` — caller-supplied keys win.
- `LogContext` (exported from `LoggingModule`): `new LogContext(logger: LoggerService,
  attributes: Record<string, unknown>)`, same `debug/info/warn/error` surface.
- Access-log line shape: `logger.info('request', { method: string, path: string,
  statusCode: number, requestId: string })` — no other fields, ever.

## Steps

- [01 — RequestContextService (AsyncLocalStorage holder)](backend/01-request-context-service.md)
- [02 — Context-aware LoggerService + LogContext wrapper](backend/02-context-aware-logger-and-logcontext.md)
- [03 — RequestContextMiddleware (mint requestId + access log)](backend/03-request-context-middleware.md)
- [04 — Wire the middleware into AppModule](backend/04-wire-middleware-in-appmodule.md)
- [05 — Unit specs + e2e coverage](backend/05-tests.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` — CI job `backend_tests`
  (runs `npm run coverage`; must stay green including coverage thresholds).
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` — CI job `backend_checks`
  (`eslint src`; flat config, `complexity` ≤ 10, max 300 lines/file, `jsdoc` required on
  every method — match the existing `@param`/`@returns` style in `core/`).

## Notes

- **No `uuid` dependency** — use `randomUUID` from `node:crypto`. `AsyncLocalStorage` comes
  from `node:async_hooks`. No `package.json` change.
- **`LoggerService` constructor gains a second parameter** (`RequestContextService`). The
  existing `logger.service.spec.ts` instantiates `new LoggerService(buildConfigService() as
  never)` directly in many `describe` blocks — every one of those call sites must be updated
  to pass a `RequestContextService` double. Covered in step 05.
- **ALS in the `finish` listener**: HTTP keeps the async context across the response
  lifecycle in practice, but step 03 deliberately captures `requestId` in a local and passes
  it explicitly to the access-log call, so that line does not depend on it. Sub-issues 3-5,
  which log from inside the handler (still within `run()`), rely on the ALS path — that is
  the well-trodden `nestjs-pino` / `cls-rtracer` pattern and is fine.
- **`forRoutes('*')`** is valid on NestJS 10 + `@nestjs/platform-express` 10 (Express 4). If
  a future Express 5 bump breaks the `'*'` wildcard, switch to `{ path: '*', method:
  RequestMethod.ALL }` or a `MiddlewareConsumer` `.exclude()`-free `.forRoutes(AppModule)`.
- **`path` value**: use `req.originalUrl` (falls back to `req.url`) so the logged path is the
  full request path as received, before any Nest routing rewrites. It still must never
  include query-string secrets — Kerghan has none today, but keep the field to the path only
  if `originalUrl` carries a query string (`.split('?')[0]`).
- **Never widen the access-log fields.** Only `method` / `path` / `statusCode` / `requestId`.
  No headers, no cookies, no body — mirrors scylla's `SecuredRequestHandler` discipline
  (`~/messages/logs.md` §5b). The e2e spec in step 05 asserts a planted
  `Cookie: access_token=...` never appears in any logged argument.
- **Level**: the access-log line is `info` (visible by default; `KERGHAN_LOG_LEVEL` defaults
  to `info`). Not `debug`.
- Middleware ordering: `RequestContextMiddleware` is the only middleware; if a later issue
  adds more, this one must remain first so every other component sees the context.
