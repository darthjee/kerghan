# Issue: Request correlation: LogContext-equivalent + global request-logging interceptor

## Description

Split from #49 (see that issue for the full design rationale). Depends on #50 — the Core logger
service (`backend/src/core/logger.service.ts`, an injectable `LoggerService` with
`debug/info/warn/error(message, attributes?)` and `KERGHAN_LOG_LEVEL` threshold, exported from the
`@Global()` `LoggingModule`). This sub-issue is the first real *consumer* of that service and adds
the first of the 5 initial logging points from #49: **incoming requests**.

Kerghan currently has no request-correlation mechanism and no interceptor/middleware of any kind
(`grep`-confirmed: no `NestInterceptor`/`NestMiddleware` implementation anywhere in `backend/src`;
`main.ts` only wires `cookie-parser` and a global `ValidationPipe`; the only global request-time
components are the `JwtGuard` and `AdminGuard` registered as `APP_GUARD` providers in
`app.module.ts`). Without a shared identifier tying a single request's log lines together, the 5
logging points from #49 would otherwise produce isolated, uncorrelated log lines instead of one
traceable flow per request.

The #50 `LoggerService` has **no attribute-binding / child-logger capability yet** — it takes an
optional `attributes` object per call and merges nothing. Scylla's reference design
(`~/messages/logs.md` §1) has a `LogContext` decorator: constructed with a fixed `attributes`
object (e.g. `{ workerId, jobId }`), it exposes the same `debug/info/warn/error` surface but merges
its bound attributes into every call before forwarding to the underlying logger. This sub-issue
adapts that idea to a per-request `{ requestId }` binding, and that binding mechanism must be
*built here* — it does not exist after #50.

## Problem

- No request correlation exists: two log lines from the same incoming request currently have no
  shared identifier linking them.
- No incoming-request logging exists at all today, at any level.
- Per-controller manual logging (adding a log call in every route handler) was explicitly rejected
  during #49's planning: it fights the project's thin-controllers convention and wouldn't
  automatically cover future modules.

## Expected Behavior

- Every incoming HTTP request is logged automatically — method, path, and response status only —
  via a global Nest interceptor or middleware, not manual per-controller calls.
- **Never log headers or cookies** — in particular the `access_token` cookie (`httpOnly`) must
  never reach a log line. Only the hand-picked safe fields (method / path / status) go in,
  mirroring scylla's own "manual safe-field picking for HTTP logging" discipline
  (`SecuredRequestHandler.js`, `~/messages/logs.md` §5b). Note scylla additionally logs the request
  `body`; Kerghan deliberately does **not** — status replaces it.
- A request-scoped identifier (`requestId`, a generated UUID v4) is available to be bound onto every
  log call made while handling that request, via a `LogContext`-equivalent built on top of #50's
  `LoggerService`. `LoggerService` itself becomes context-aware: a bare injected `LoggerService`
  automatically merges the active `{ requestId }` into every call, so later sub-issues (3-5) get
  correlation for free with **no new provider to inject and no per-call-site plumbing** — they keep
  injecting `LoggerService` exactly as they do today.
- The per-request line is logged at **`info`** level (a real access log — visible by default, since
  `KERGHAN_LOG_LEVEL` defaults to `info`).
- Requests **rejected by the global guards** (`JwtGuard` / `AdminGuard` → 401 / 403, thrown before
  the route handler runs) are still logged, with their response status.

## Solution

### Scope

This sub-issue covers:

- The concrete request-ID generation/propagation mechanism (left as an open implementation decision
  by #49 itself). **Decision: a Nest middleware that generates a UUID v4 per request and runs the
  rest of the request inside an `AsyncLocalStorage` store holding `{ requestId }`** — not a
  request-scoped provider. Request-scoped providers are transitively viral in Nest DI and force a
  fresh injector subtree per request; ALS keeps `LoggerService` a plain singleton and composes
  cleanly with the existing `APP_GUARD` registration order.
- A `LogContext`-equivalent: a small wrapper around #50's `LoggerService` that pre-binds a fixed set
  of attributes (starting with `{ requestId }`) and merges them into every subsequent
  `debug/info/warn/error` call. When ALS holds no request context (e.g. code running outside a
  request), calls pass through unchanged.
- Making `LoggerService` itself context-aware: when an ALS request context is active, every
  `LoggerService` call automatically merges the bound `{ requestId }` in. This is the mechanism
  sub-issues 3-5 rely on — they keep injecting `LoggerService` unchanged and get correlated log
  lines with no new provider and no per-call-site plumbing. (The standalone `LogContext` wrapper is
  still provided for code that wants to bind attributes explicitly, but it is not the required path
  for the downstream sub-issues.)
- The global middleware itself, logging method / path / status for every incoming request using the
  bound `requestId`, at **`info`** level. It logs on response completion (`res.on('finish')`) so it
  also captures the status of requests rejected by the global guards (401 / 403) — an interceptor
  registered via `APP_INTERCEPTOR` would not fire for those, since guards run before interceptors
  reach the handler.

Explicitly **out of scope**:

- Any logging point other than "incoming requests" (email sending, email-flag checks,
  password-recovery request/outcome) — separate sub-issues.
- Migrating existing ad-hoc `Logger`/`console.*` call sites — separate sub-issue.
- Extending correlation beyond a single request (background jobs, cross-request tracing) — not a
  current need.
- Trusting or honoring an inbound `X-Request-Id` header — the `requestId` is always freshly
  generated. Exposing it on the response as an `X-Request-Id` header is optional and may be added
  here if cheap, but is not required.

### What needs to be done

- Add a global Nest middleware (registered via `AppModule` implementing `NestModule` /
  `configure(consumer)`, applied to `'*'`) that mints a UUID v4 `requestId` and runs the rest of
  the request inside `AsyncLocalStorage.run({ requestId }, next)`.
- Implement the `LogContext`-equivalent on top of #50's `LoggerService` (pre-bound attributes
  merged into every subsequent `debug/info/warn/error` call), and make `LoggerService` read the
  active ALS store so a bare injected `LoggerService` is already correlated; explicit per-call
  `attributes` win over the bound `requestId` on key collision.
- In the same middleware (or a dedicated one on the same chain), register `res.on('finish')` to
  emit one `info` log line per request with `{ method, path, statusCode, requestId }` — only those
  fields, no headers, no cookies, no body. It must fire for guard-rejected requests (401 / 403)
  too.
- Wire it in `AppModule` so it automatically covers every current and future route with no
  per-controller code.
- e2e coverage (an `*.e2e-spec.ts` under `backend/src/**/tests/`, `@nestjs/testing` +
  `supertest`, in the established in-memory-repo style) confirming: a request produces exactly one
  such log line with method/path/status at `info`; the line carries a `requestId`; two log calls in
  the same request share that `requestId`; a guard-rejected (401) request is still logged with its
  status; and no header or cookie value ever appears in the line.

### Acceptance criteria

- [ ] A `requestId` (UUID v4) is generated per incoming request and stored in an
      `AsyncLocalStorage` for the duration of that request.
- [ ] A `LogContext`-equivalent exists, built on #50's `LoggerService`, that pre-binds a fixed set
      of attributes (starting with `requestId`) onto every call made within a scope.
- [ ] A bare injected `LoggerService` automatically merges the active request's `requestId` into
      every `debug/info/warn/error` call, with no new provider to inject at the call site.
- [ ] A global middleware logs method, path, and response status (at `info`) for every incoming
      request, with no manual per-controller logging code required.
- [ ] Requests rejected by the global guards (401 / 403) are still logged, with their status.
- [ ] No header or cookie value (in particular the `access_token` cookie) ever reaches a log line
      produced by this middleware.
- [ ] e2e coverage confirms all of the above for at least one existing route, including that two
      log calls in one request share the same `requestId`.

## Benefits

- Establishes request correlation once, centrally, before the remaining logging points (sub-issues
  3-5) are built — cheaper than retrofitting correlation onto each call site afterward.
- Automatically covers every route, current and future, with zero per-controller logging code.
- Keeps `LoggerService` a plain singleton (no request-scoped DI), so correlation adds no injector
  overhead per request.
