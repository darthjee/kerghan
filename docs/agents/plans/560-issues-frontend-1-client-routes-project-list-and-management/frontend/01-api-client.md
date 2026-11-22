# API client and ApiError.meta

**`ApiError.meta`.** `ApiError` gains an optional `meta`, which is `undefined` when absent. `buildApiError` in `ApiClient.js` reads `error.meta` from the error body. Existing callers are unaffected.

**Client classes.** Add `ProjectsClient` and `IssuesClient`, following `RepositoriesClient`. Each takes an `ApiClient`, uses `postJson`, and drops undefined fields with `pickDefined`.

- **`ProjectsClient`:**
  - `list({ page, perPage, search })` → `mine.json`
  - `create({ name, description, repository })`, where `repository` is `{ githubId }` or `null`
  - `createFromRepository({ githubId, name? })`
  - `show(projectId)`
  - `edit(projectId, { name, description })`
  - `setRepository(projectId, repository | null)`
  - `delete(projectId)`
  - `refresh(projectId)`
- **`IssuesClient`:**
  - `list(projectId, { state, search, page, perPage })`
  - `create(projectId, { title, body })`
  - `show`, `edit` (`{ title?, body?, state? }`) and `delete`
  - `import(projectId, { number })`
  - `attach(projectId, issueId, { number, confirmUpdatedAt? })`
  - `unlink(projectId, issueId, { discard? })`
  - `refresh` and `retrySync`

  Before writing the request shapes, check the exact field names against `backend/src/issues/*.controller.ts` and the DTOs.

**Path ids (S3).** Every path id goes through `encodeURIComponent` and the uuid guard from step 02. An invalid id rejects with a 404-shaped `ApiError` and makes **no** fetch. This step needs the guard, so build the guard first or within this step.

**Specs.** Write them against `fetchSequence`, one per method:

- the path
- the body
- the error mapping, with `code`, `status`, `details`, `retryAfterSeconds` and `meta`
- `meta` is `undefined` when absent
- the encoded-path case (`..%2Fadmin`)

**Builders.** Add typed builders in a new `frontend/specs/support/issuesBuilders.js` (project, issue, link, pagination, error body), with its own spec as the other support files have.

## Files to Change
- `frontend/assets/js/client/ApiError.js`: the `meta` field
- `frontend/assets/js/client/ApiClient.js`: `buildApiError` reads `error.meta`
- `frontend/assets/js/client/ProjectsClient.js` (new)
- `frontend/assets/js/client/IssuesClient.js` (new)
- `frontend/specs/assets/js/client/ApiErrorSpec.js` and `ApiClientSpec.js`: the `meta` cases
- `frontend/specs/assets/js/client/ProjectsClientSpec.js` and `IssuesClientSpec.js` (new)
- `frontend/specs/support/issuesBuilders.js` and `issuesBuildersSpec.js` (new)
