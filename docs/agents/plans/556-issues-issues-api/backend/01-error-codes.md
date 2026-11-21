# Error codes and helpers

Add the three issue codes of the catalogue (`docs/agents/specs/issues/api/errors-and-validation.md#error-catalogue`) to `ErrorCodes`, and give each one a helper in `issues-http-errors.ts`, next to the project helpers. Messages are copied verbatim from the catalogue.

| Helper | Exception | Code | Message | Extra |
|---|---|---|---|---|
| `issuesLimitReached()` | `ConflictException` (409) | `ISSUES_LIMIT_REACHED` | `This project reached the maximum number of issues` | — |
| `issueEditRateLimited(retryAfterSeconds)` | `HttpException` (429) | `ISSUE_EDIT_RATE_LIMITED` | `Too many edits; try again later` | `retryAfterSeconds`, which the filter turns into `Retry-After` and `error.retryAfterSeconds`, as in `repositories-http-errors.ts#addRateLimited` |
| `issueLinked()` | `ConflictException` (409) | `ISSUE_LINKED` | `Unlink this issue before deleting it` | — |

Unit-test each helper's status, code, message and (for the 429) its `retryAfterSeconds`, in `tests/issues-http-errors.spec.ts`.

## Files to Change

- `backend/src/core/error-codes.ts` — add `ISSUES_LIMIT_REACHED`, `ISSUE_EDIT_RATE_LIMITED` and `ISSUE_LINKED`.
- `backend/src/issues/issues-http-errors.ts` — the three helpers.
- `backend/src/issues/tests/issues-http-errors.spec.ts` — the helper specs.
