# Plan: Define a standard API error response format and status-code mapping

Issue: [283-define-a-standard-api-error-response-format-and-status-code-mapping.md](../../issues/283-define-a-standard-api-error-response-format-and-status-code-mapping.md)

## Overview
Add a global NestJS exception filter that reshapes every backend error into
`{ error: { code, message, details? }, statusCode, timestamp }`, with category codes derived from
the status and specific codes (`USERNAME_TAKEN`, `EMAIL_TAKEN`) attached at the throw site. Remap
uniqueness conflicts to `409` and the lockout to a dedicated `423` exception, and log unexpected
errors behind a generic `500`. The frontend `ApiClient`/`ApiError` switch to the new shape, which
also resolves #42. The format and mapping are documented in the architecture docs.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

**Error response body** — every non-2xx JSON response from the backend:

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

| Field | Type | Notes |
|---|---|---|
| `error.code` | `string` | Always present. Category code by default; specific code when set at the throw site. |
| `error.message` | `string` | Always present, human-readable. For validation failures: the validation messages joined with `"; "`. |
| `error.details` | `string[]` | Optional — present only for `ValidationPipe` failures (the full message list). |
| `statusCode` | `number` | Same as the HTTP status. |
| `timestamp` | `string` | ISO-8601 (`new Date().toISOString()`). |

**Category codes by status** (default when no specific code is given):

| Status | Code |
|---|---|
| 400 (ValidationPipe, `message` is an array) | `VALIDATION_FAILED` |
| 400 (other) | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 423 | `LOCKED` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 / non-HTTP errors | `INTERNAL_ERROR` (message always `"Internal server error"`) |
| any other status | `HTTP_<status>` |

**Specific codes introduced by this issue:**

| Failure | Status | Code |
|---|---|---|
| Username taken (register, account edit, admin user edit) | 409 | `USERNAME_TAKEN` |
| Email taken (register, account edit, admin user edit) | 409 | `EMAIL_TAKEN` |

**Status-code changes visible to the frontend:** taken username/email moves from `400` to `409`
(messages unchanged). Everything else keeps its current status. No frontend code currently branches
on `400` for these, so only the message extraction must change.
