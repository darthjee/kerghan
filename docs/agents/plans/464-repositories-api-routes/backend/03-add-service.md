# `RepositoryAddService`

This step adds `RepositoryAddService` (`repositories/repository-add.service.ts`), which runs `api.md#add` after DTO validation, in order:

1. `rateLimiter.consume(userId)`. When refused, throw `addRateLimited(ceil(retryAfterMs / 1000))`.
2. `repositories.reconcileForRequest(userId)`. On `no_user`, throw `401 UNAUTHORIZED` (as `PATCH /auth/account.json` does for a deleted session user, `model.md`).
3. `repositories.findByRef(userId, ref)`. When it returns `null`, throw `repositoryNotFound()`. No GitHub call happens and nothing is written.
4. When `found.repository.status === 'added'` (`addedAt !== null`), return `found.repository` unchanged. No GitHub call happens and nothing is written.
5. The candidate walk: `walkAddCandidates({ userId, githubId: found.repository.githubId, holderIntegrationIds, handleSeesRepo, usable: await github.listUsableIntegrations(userId) }, (u, i, g) => github.getRepository(u, i, g))`. The re-check uses only the stored row's `githubId`, never the request's `fullName`. It maps the walk's outcome:
   - `no_candidate` → `repositorySourceUnusable()` (`409`);
   - `denied` → `repositoryNotFound()`;
   - `rate_limited` → `githubRateLimited(seconds until resetAt, rounded up, or undefined)`;
   - `unavailable` → `githubUnavailable()`;
   - `ok` → step 6.
6. `repositories.markAdded(userId, { githubId }, linkIntegrationId, { owner, name, private })`, with the snapshot taken from the walk's `repo`. Then:
   - `added` / `already_added` → return `repository`;
   - `gone` → `repositoryNotFound()`.

The service returns a `ListedRepository`; the controller shapes it. It never logs GitHub error bodies or anything from `RepoResult` other than its kind.

## Files to Change

- `backend/src/repositories/repository-add.service.ts`: new.
- `backend/src/repositories/repositories.module.ts`: provide `RepositoryAddService` and `RepositoryAddRateLimiter`.
- `backend/src/repositories/tests/repository-add.service.spec.ts`: unit tests with a typed `RepositoriesService` stub, `FakeIntegrationsGithubService` and `FakeClock`. They cover:
  - each step's short-circuit: no GitHub call on a `404` or on already-added;
  - the rate limit counted before the lookup, so a `404` attempt also counts;
  - the walk outcome mapping (`409`, `404`, `503` with and without a reset, `502`);
  - the re-check built from the stored `githubId` when the ref was a differently-cased `fullName`;
  - `gone` → `404`, and `already_added` → the stored row.
