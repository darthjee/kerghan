# Context-aware LoggerService + LogContext wrapper

Make a bare-injected `LoggerService` automatically carry the active request's `requestId`,
and add the explicit `LogContext` binding wrapper the issue's acceptance criteria require.

## LoggerService changes (`backend/src/core/logger.service.ts`)

- Constructor gains a second injected parameter:
  `constructor(configService: ConfigService, private readonly requestContext: RequestContextService)`.
  Keep reading `KERGHAN_LOG_LEVEL` exactly as today.
- In the private `write(level, message, attributes?)` method, before emitting:
  - Read `const requestId = this.requestContext.getRequestId()`.
  - If `requestId` is defined, build the effective attributes as
    `{ requestId, ...attributes }` — so an explicit per-call key of the same name **wins**
    (caller-supplied `attributes` spread last). If `requestId` is undefined, behaviour is
    exactly as today (pass `attributes` through untouched, including the `undefined` →
    `console[level](message)` single-arg path).
  - Keep the existing "no attributes → single-arg `console[level](message)`" branch only for
    the no-context + no-attributes case. With a context active, always emit the
    two-arg form `console[level](message, { requestId, ...attributes })`.
- The `LoggerService implements NestLoggerService` contract (`log`/`verbose`/`toAttributes`)
  is unchanged beyond flowing through the same `write()`.
- Keep the file under 300 lines and complexity ≤ 10 — the merge is a couple of lines; if
  `write()` tips over complexity 10, extract a small private
  `resolveAttributes(attributes?): Record<string, unknown> | undefined` helper.
- JSDoc: document the new constructor param and note in `write()`'s JSDoc that the active
  request context's `requestId` is merged in (caller keys win).

## LogContext wrapper (`backend/src/core/log-context.ts`)

- Plain class (not `@Injectable()` — it is constructed ad hoc, like scylla's `LogContext`):
  `new LogContext(logger: LoggerService, attributes: Record<string, unknown>)`.
- Exposes `debug/info/warn/error(message: string, attributes?: Record<string, unknown>):
  void`, each forwarding to the matching `logger` method with
  `{ ...this.boundAttributes, ...attributes }` (per-call keys win, same rule as above).
- Store the bound attributes as a defensive shallow copy (`{ ...attributes }`) in the
  constructor.
- No dependency on `RequestContextService` — it is the manual/explicit binding path. It
  composes naturally with the context-aware `LoggerService` (a `LogContext` used inside a
  request gets both its bound attrs and the `requestId`).
- Full JSDoc on the constructor and all four methods.

## Export

`backend/src/core/logging.module.ts` — no provider entry for `LogContext` (it is not a
provider), but re-export the class from the module file or leave consumers to import it
directly from `./log-context.js`. Prefer a direct import path; note it in the module JSDoc so
it is discoverable.

## Files to Change

- `backend/src/core/logger.service.ts` — inject `RequestContextService`; merge the active
  `requestId` into every emitted line, caller attributes winning on collision.
- `backend/src/core/log-context.ts` — new: explicit attribute-binding wrapper around
  `LoggerService` with the same `debug/info/warn/error` surface.
- `backend/src/core/logging.module.ts` — mention `LogContext`'s import path in the JSDoc (no
  provider change).
