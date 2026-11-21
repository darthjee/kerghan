# Error codes and `error.meta`

Add the project error codes and the optional `error.meta` member of the standard error shape (`api/projects.md#refusal-data-errormeta`).

- **`core/error-codes.ts`:** add `PROJECTS_LIMIT_REACHED`, `PROJECT_NAME_TAKEN`, `PROJECT_REPOSITORY_TAKEN`, `PROJECT_REPOSITORY_NOT_ADDED` and `PROJECT_HAS_LINKS`. The other codes of the catalogue arrive with the issues that throw them.
- **`core/http-exception.filter.ts`:**
  - Add `meta?: Record<string, string | number>` to `ErrorPayload` and `meta?: unknown` to `HttpExceptionResponse`.
  - `buildHttpPayload` copies `meta` when the throw-site object carries a plain object, and never on the `ValidationPipe` array path.
  - Update the class JSDoc that lists the body shape.
- **`issues/issues-http-errors.ts`:** add one helper per code, with the exact messages of the catalogue:
  - `projectsLimitReached()`
  - `projectNameTaken()`
  - `projectRepositoryTaken(projectUuid)`, with `meta: { projectId }`
  - `projectRepositoryNotAdded()`
  - `projectHasLinks(linkCount)`, with `meta: { linkCount }`

  Also export a `repositoryNotFound` re-use: import `repositoryNotFound` from the Repositories public surface if it is exported. Otherwise add an identical helper with `REPOSITORY_NOT_FOUND_MESSAGE` (`Repository not found`), so the body matches Add byte for byte.
- **`docs/agents/architecture/backend/error-responses.md`:** describe `error.meta` (optional, set at the throw site, only public ids, counts, field names, timestamps or reasons).

## Files to Change
- `backend/src/core/error-codes.ts` — five new codes.
- `backend/src/core/http-exception.filter.ts` — `error.meta` pass-through.
- `backend/src/core/tests/http-exception.filter.spec.ts` — `meta` copied when present, absent otherwise, ignored on validation errors.
- `backend/src/issues/issues-http-errors.ts` — the five helpers plus the repository `404`.
- `backend/src/issues/tests/issues-http-errors.spec.ts` — status, code, message and `meta` of each helper (new).
- `docs/agents/architecture/backend/error-responses.md` — document `error.meta`.
