# RequestContextService (AsyncLocalStorage holder)

Introduce the request-scoped correlation store as an injectable Core provider, so the rest
of the codebase never touches `AsyncLocalStorage` directly and the DI-only rule
(`docs/agents/architecture/modular-pattern.md`) holds.

## What to build

`backend/src/core/request-context.service.ts`:

- `@Injectable()` class `RequestContextService`.
- Private field: `private readonly storage = new AsyncLocalStorage<RequestContext>()` where
  `interface RequestContext { requestId: string }` (declare the interface in this file and
  `export` it — sub-issues 3-5 and the middleware import it).
- `run<T>(requestId: string, callback: () => T): T` — `return this.storage.run({ requestId },
  callback)`.
- `getRequestId(): string | undefined` — `return this.storage.getStore()?.requestId`.
- Optional `getContext(): RequestContext | undefined` — `return this.storage.getStore()` (add
  only if step 02/03 needs the whole object; otherwise skip to keep the surface minimal).
- JSDoc (`@param`/`@returns`) on every public method, matching `cache-token.service.ts` style.

Import `AsyncLocalStorage` as `import { AsyncLocalStorage } from 'node:async_hooks';`
(mirrors the `node:crypto` import convention already in `core/`).

## Register it

`backend/src/core/logging.module.ts`:

- Add `RequestContextService` to both `providers` and `exports`.
- Update the module JSDoc to mention it alongside `LoggerService` (the `@Global()` comment
  already lists "a future request-logging interceptor" as a consumer).

Keeping it in `LoggingModule` (already `@Global()`) means `LoggerService` (step 02) and
`RequestContextMiddleware` (step 03) can both inject it with no extra `imports`.

## Files to Change

- `backend/src/core/request-context.service.ts` — new: injectable `AsyncLocalStorage`
  wrapper exposing `run()` / `getRequestId()` and the exported `RequestContext` interface.
- `backend/src/core/logging.module.ts` — add `RequestContextService` to `providers` and
  `exports`; extend the module JSDoc.
