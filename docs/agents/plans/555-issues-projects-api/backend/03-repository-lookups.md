# Repository lookups for projects

The Issues module reads Repositories only through the exported `RepositoriesService` (the module boundary of #553). `findByRef` returns the listing row without the internal id, but a project stores `repository_id` and its read model needs a summary per id. Add two methods to `RepositoriesService`. Repositories keeps owning the queries.

- **`resolveForProject(userId, ref)`** returns `{ repositoryId, added, summary } | null`:
  - It resolves the ref through `AddStore.resolve`, so the case-insensitive `fullName` and the tie-break are the same as Add.
  - It reads the row through `RepositoriesListingQuery.one` with the user's scope, for the derived status.
  - `added` is `addedAt !== null`. `summary` is `{ githubId, owner, name, fullName, private, status }`.
  - `null` means not among the caller's rows.
- **`projectSummaries(userId, repositoryIds[])`** returns a `Map<number, RepositorySummary>`:
  - It makes one query for the page, not one per project: an `IN` variant of `RepositoriesListingQuery`, or a small dedicated query reusing its status derivation.
  - A missing id (dangling reference) is absent from the map. The caller renders it as `{ githubId: null, owner: null, name: null, fullName: null, private: null, status: 'unavailable' }`.
- Both are scoped to `userId`. They never return another user's row and never expose an internal id beyond `repositoryId`, which stays inside the backend.
- The shortcut's default name is `summary.fullName` (`owner/name` from the latest snapshot).

## Files to Change
- `backend/src/repositories/repositories.service.ts` — the two methods.
- `backend/src/repositories/repositories-listing.query.ts` — a multi-id read, if `one` cannot be reused without N queries.
- `backend/src/repositories/types/repositories-api.types.ts` — `RepositorySummary` and `ProjectRepositoryLookup` types.
- `backend/src/repositories/tests/repositories.service.project-lookups.db-spec.ts` — another user's row is `null`; a not-added row has `added: false`; every derived status; a dangling id is absent; one query for many ids (new).
