# Architecture — Backend: Error responses

Part of [Architecture — Backend](../backend.md): the standard error body and the
dependency-injection rule.

## Error responses

Every non-2xx JSON response has the same body, written by the global catch-all filter
`core/http-exception.filter.ts` (`HttpExceptionFilter`). It is registered in `AppModule` as an
`APP_FILTER` provider (not `app.useGlobalFilters` in `main.ts`) so it receives `LoggerService`
through DI and e2e test apps register it the same way (`build-auth-test-app.ts`). It covers
`ValidationPipe` failures, guard rejections, service exceptions and unexpected errors alike.

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "username is not available",
    "details": ["..."]
  },
  "statusCode": 409,
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

| Field | Notes |
|---|---|
| `error.code` | Always present. Category code by default; specific code when set at the throw site. |
| `error.message` | Always present, human-readable. For validation failures: the messages joined with `"; "`. |
| `error.details` | Only for `ValidationPipe` failures — the full list of validation messages. |
| `error.retryAfterSeconds` | Optional. Present when the throw site sets `retryAfterSeconds` (e.g. `429` cooldowns and rate limits, some `503`s); the response then also carries a `Retry-After` header with the same whole number of seconds. |
| `statusCode` | Same as the HTTP status. |
| `timestamp` | ISO-8601 (`new Date().toISOString()`). |

**Category codes** (`categoryCodeFor` in `core/error-codes.ts`), used when the throw site gives
no specific code:

| Status | Code |
|---|---|
| 400 (`ValidationPipe`, array `message`) | `VALIDATION_FAILED` |
| 400 (other) | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 423 | `LOCKED` (`core/locked.exception.ts`'s `LockedException`) |
| 429 | `TOO_MANY_REQUESTS` |
| 500 / non-HTTP errors | `INTERNAL_ERROR` |
| any other status | `HTTP_<status>` |

**Specific codes** are attached at the throw site by passing an object response, with the
constant taken from `ErrorCodes` in `core/error-codes.ts` (never a repeated string literal):

```ts
throw new ConflictException({ code: ErrorCodes.USERNAME_TAKEN, message: 'username is not available' });
```

Current specific codes: `USERNAME_TAKEN` and `EMAIL_TAKEN` (`409`, from registration, account
edit and admin user edit). Pick the status by meaning — a uniqueness conflict is `409`, not `400`.

**Client errors from Express middleware.** Express body-parser failures other than malformed
JSON (which Nest itself turns into a `BadRequestException`) are http-errors-style plain errors
carrying a numeric `statusCode`/`status` — e.g. `413` for a body over the parser limit (100kb by
default), `415` for an unsupported charset/encoding, `400` for an aborted request. Any
non-`HttpException` error with a numeric 4xx `statusCode` (preferred) or `status` keeps that
status and its category code (`HTTP_413`, `HTTP_415`, `BAD_REQUEST`, ...), with the fixed
standard reason phrase from `node:http`'s `STATUS_CODES` as `error.message` (e.g.
`Payload Too Large`) — never the raw parser text. They are logged at `debug` only (`client
error`, status and error name, no stack) so anonymous clients cannot flood the error log.

**Unexpected errors.** Anything else that is not an `HttpException` answers `500` with
`{ code: 'INTERNAL_ERROR', message: 'Internal server error' }`; the real message and stack are
logged through `LoggerService#error('unhandled exception', ...)` and never sent to the client.

**Enumeration safety.** Errors that are deliberately uniform (e.g. `Invalid username or
password`, `Invalid or expired refresh token`, `Invalid or expired token`, the
authorization-request `Unable to authorize/deny this request` failures, and the `404` for an
unknown vs. wrong-token authorization request) must keep one status, one message and the
category code only. Never attach a specific code that would let a caller tell the underlying
cases apart.

## Dependency injection only

Classes never read env vars or import global state directly (`src/database/data-source.ts`, see
[Data source](request-pipeline.md#data-source), is the sole, deliberate exception) — the DB connection, JWT secret, etc. are constructed
once (via `ConfigService`) and injected. See `docs/agents/contributing.md`'s DI rule.
