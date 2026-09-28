# Issue: Define a standard API error response format and status-code mapping

## Description
There is no defined contract for how API errors are shaped. The backend has no custom exception filter (`backend/src/main.ts` only registers a global `ValidationPipe`), so NestJS's default body — `{ statusCode, message, error }` — goes out on the wire, where `error` is just the generic HTTP status text and the descriptive text lives in `message` (a `string[]` for `ValidationPipe` failures).

This issue supersedes #42: it defines the error contract on both sides, so the frontend/backend mismatch described there is fixed here and #42 should be closed when this ships.

## Problem
- The frontend `ApiClient` (`frontend/assets/js/client/ApiClient.js`) reads `data.error` as the message, so users see generic text like "Bad Request" instead of e.g. "username is not available" (see #42).
- Status codes are not mapped consistently to business failures: e.g. "Username already in use" / "email is not available" are `400` rather than `409`; account lockout uses a raw `HttpException(423)`.
- Clients have no machine-readable way to distinguish failures (only free-text messages).
- Unexpected (non-HTTP) errors fall through to Nest's default handling.
- No test asserts the error response body, so shape mismatches go unnoticed.

## Expected Behavior
Every error response from the backend has this shape, applied globally:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Username already in use",
    "details": ["..."]
  },
  "statusCode": 409,
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

- `error.code` — machine-readable code. Defaults to a **category code** derived from the status/exception type (`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `LOCKED`, `INTERNAL_ERROR`, ...). Where the frontend would react differently, a **specific code** is set at the throw site instead (e.g. `USERNAME_TAKEN`, `EMAIL_TAKEN`).
- `error.message` — human-readable message.
- `error.details` — optional; for `ValidationPipe` failures it holds the full list of validation messages, while `error.message` carries a joined/first-message summary.
- Unexpected (non-HTTP) errors return `500` with `{ code: "INTERNAL_ERROR", message: "Internal server error" }` — no stack traces or internal details — and the full error is logged via `LoggerService`.

Status codes are **remapped** to a documented mapping, changing existing exceptions that don't follow it:

| Failure | Status | Default code |
|---|---|---|
| Malformed input / DTO validation | 400 | `VALIDATION_FAILED` / `BAD_REQUEST` |
| Missing/invalid authentication | 401 | `UNAUTHORIZED` |
| Authenticated but not allowed (admin, CSRF/origin) | 403 | `FORBIDDEN` |
| Resource not found | 404 | `NOT_FOUND` |
| Uniqueness conflict (username/email in use) | 409 | `CONFLICT` (+ specific codes) |
| Account temporarily locked | 423 | `LOCKED` |
| Unexpected error | 500 | `INTERNAL_ERROR` |

Existing enumeration-safe uniform errors (e.g. invalid/expired token, invalid username or password) must stay uniform — remapping must not introduce distinguishable responses where they are intentionally identical today.

## Solution
- **Backend:** add a global exception filter in `backend/src/core/`, registered in `main.ts`, that reshapes every exception into the standard format (category code by default, specific code when provided by the exception, `details` from `ValidationPipe` arrays, generic 500 + logging for non-HTTP errors). Provide a small way to attach a specific code at the throw site (e.g. a custom exception or an options/cause convention). Remap existing exceptions to the documented status codes (e.g. "already in use" / "not available" → `409` with `USERNAME_TAKEN` / `EMAIL_TAKEN`; lockout → a proper exception producing `423`/`LOCKED`), updating specs accordingly.
- **Frontend:** update `ApiClient` to build `ApiError` from `data.error.message` and expose `data.error.code` (and `details`), updating `ApiClientSpec.js` and any consumers relying on the old status codes (e.g. 400 → 409 for taken username/email).
- **Docs:** document the error format, the code list and the status-code mapping in `docs/agents/architecture/backend.md` (and reference it from `frontend.md`).
- **Tests:** add e2e assertions on the actual error response body (at least a validation failure, a conflict such as `register.json` with a taken username, and an auth failure).

## Benefits
- Frontend and backend agree on a single error contract, fixing incorrect error messages shown to users (#42).
- Machine-readable codes let the frontend react to specific failures without parsing messages.
- Consistent, predictable status codes and no internal-detail leaks on unexpected errors.
