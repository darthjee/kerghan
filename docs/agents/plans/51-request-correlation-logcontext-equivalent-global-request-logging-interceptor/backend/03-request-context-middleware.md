# RequestContextMiddleware (mint requestId + access log)

One global Nest middleware that both establishes the correlation context and emits the
per-request access-log line.

## What to build (`backend/src/core/request-context.middleware.ts`)

- `@Injectable()` class `RequestContextMiddleware implements NestMiddleware` (from
  `@nestjs/common`).
- Constructor injects `RequestContextService` and `LoggerService`.
- `use(req: Request, res: Response, next: NextFunction): void` (types from `express`):

  ```ts
  const requestId = randomUUID();
  this.requestContext.run(requestId, () => {
    res.on('finish', () => {
      this.logger.info('request', {
        method: req.method,
        path: (req.originalUrl ?? req.url).split('?')[0],
        statusCode: res.statusCode,
        requestId,
      });
    });
    next();
  });
  ```

- `randomUUID` from `node:crypto` (v4 UUID).
- `requestId` is passed **explicitly** into the `info` call — the access-log line does not
  depend on ALS propagating into the `finish` listener.
- Register the `finish` listener *inside* `run()` and before `next()`, so it is attached
  exactly once per request and the surrounding handler chain executes within the context.
- Only these four fields. No `req.headers`, no `req.cookies`, no `req.body`. Do not add a
  `res.on('close')` fallback in this issue (keep scope tight) — `finish` fires for every
  normally-completed response including 401/403 from the guards.
- `this.logger.info(...)` respects `KERGHAN_LOG_LEVEL` (default `info` → visible). No level
  branching in the middleware.
- Full JSDoc on the class and `use()`.

## Complexity / size

Trivially under the 300-line and complexity-10 limits. If ESLint's `sort-class-members`
complains, order members to match the other `core/` classes (fields, constructor, then
public method).

## Files to Change

- `backend/src/core/request-context.middleware.ts` — new: global `NestMiddleware` that mints
  a UUID v4 `requestId`, runs the request inside `RequestContextService.run()`, and logs
  `('request', { method, path, statusCode, requestId })` at `info` on `res.on('finish')`.
