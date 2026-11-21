# Listing, show and edit

- **`ProjectsService.list(userId, { page, perPage, search })`:**
  - Live projects only, sorted by `name` (case-insensitive by collation; stable since names are unique among live projects).
  - `search` is a literal, case-insensitive substring of the name. Escape `%`, `_` and `\` with the same rule as `escapeLike` in `repositories-listing.query.ts`. Move `escapeLike` to `core/` and import it from both modules, since Issues may not import a Repositories internal.
  - `total` and `totalPages` count the matching rows, and a page past the end answers an empty list.
  - Per page: one `projectSummaries` call and one `ProjectOpenIssueCounts.forPage` call.
- **`ProjectsService.show(userId, uuid)`:** `IssuesAccess.findLiveProject`, then the summary and the single `COUNT`.
- **`ProjectsService.edit(userId, uuid, input)`:**
  - An omitted field is unchanged; `description: null` or blank clears it.
  - An empty body, or values equal to the stored ones, answers `200` with no write and no `updated_at` change.
  - A name change checks `PROJECT_NAME_TAKEN` and maps the duplicate-entry race the same way as creation.
  - The answer is the project with its count.
- All three go through `IssuesAccess`, with no scattered `user_id` filter for access. The listing's `WHERE user_id` is the listing scope, as in `IssuesAccess`.

## Files to Change
- `backend/src/core/escape-like.ts` — moved `escapeLike` (new), and `backend/src/repositories/repositories-listing.query.ts` imports it.
- `backend/src/issues/projects.service.ts` — `list`, `show`, `edit`.
- `backend/src/issues/tests/projects.service.listing.db-spec.ts` — defaults, bounds, sort, literal search with `%` `_` `\`, totals, past-the-end page, deleted projects absent (new).
- `backend/src/issues/tests/projects.service.edit.db-spec.ts` — partial edit, clearing the description, no-op without write, name taken, rename race (new).
