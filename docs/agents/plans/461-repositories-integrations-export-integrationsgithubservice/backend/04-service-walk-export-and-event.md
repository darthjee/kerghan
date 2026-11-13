# IntegrationsGithubService, Add walk, export and deletion event

## `IntegrationsGithubService` (`integrations/integrations-github.service.ts`)

Public methods, each loading its row with `WHERE id = ? AND user_id = ?`:

- `listUsableIntegrations(userId)` returns `IntegrationRef[]` (`{ id, uuid, label, type }`):
  - the query filters on `user_id`;
  - results are ordered by `created_at`, then `id`;
  - it keeps only integrations whose reported status is `active` and whose type is enabled (`IntegrationTypeRegistry`).
- `listRepositories(userId, integrationId, page, etag?)`:
  - `pat` and `oauth_app` call `/user/repos`;
  - `github_app` calls `/installation/repositories` with a cached installation token.
- `listHandleRepositories(userId, integrationId | null, handle, page, etag?)`.
- `getRepository(userId, integrationId | null, githubId)`.

Shared flow for an authenticated call:

1. **Load:** a missing or foreign row answers `integration_unusable` (`missing`) without calling GitHub.
2. **Usability:**
   - a type that is not enabled answers `integration_unusable` (`type_disabled`);
   - a reported status other than `active` (`expired`, `invalid` or `undecryptable`) answers `integration_unusable` (`status`).
   - Neither case calls GitHub.
3. **Decrypt:** use `decryptRow`, keeping `ivUsed = row.secretIv`. On failure, compare-and-set the row to `undecryptable` and answer `integration_unusable` (`status`).
4. **Call:** use the repo client (step 02); for `github_app`, go through the token cache (step 03).
5. **On 401:**
   - `pat` and `oauth_app` compare-and-set to `invalid` with the type's reason, then answer `invalid_credentials`;
   - `github_app` follows the retry rule in step 03.

When `integrationId` is `null`, the service first calls `budget.tryAcquire('sync')` for listings or `budget.tryAcquire('add')` for `getRepository`. It then calls GitHub without `Authorization` and records every response.

Logs carry only safe fields: integration id, operation, HTTP status and result kind.

## Add walk (`integrations.md#access-link-on-add`, `#add-re-check-candidates`)

Add `integrations/add-candidate-walk.ts`, which exports the pure `walkAddCandidates(input, getRepository)`. Its input is `{ userId, githubId, holderIntegrationIds, handleSeesRepo, usable: IntegrationRef[] }`.

**Candidates, in order:**
1. usable holders, oldest first;
2. only when `handleSeesRepo`:
   - the remaining usable integrations, oldest first;
   - then `null` (unauthenticated).

**Walk rules:**
- It makes at most 3 GitHub calls.
- A `401`, a `403` (classified as `not_found`) or `not_found` moves on to the next candidate.
- `rate_limited` or `unavailable` stops the walk and returns that result.
- `integration_unusable` moves on to the next candidate without counting a GitHub call.

**Outcomes:**
- `{ kind: 'ok', repo, linkIntegrationId }`. A holder links itself. A non-holder or `null` links nothing while the repo is public, and links the granting integration when it found the repo private.
- `{ kind: 'denied' }` when the candidates or the cap are exhausted.
- `{ kind: 'no_candidate' }` when no candidate exists at all, before any call.
- The stop results described above.

Repositories (#463) maps these to HTTP answers. Both the real service and `FakeIntegrationsGithubService` use this function.

## Module export

In `IntegrationsModule`:
- add these providers: `Clock` (as `SystemClock`), `GithubRepoClientService`, `GithubInstallationTokenCache`, `GithubUnauthenticatedBudget` and `IntegrationsGithubService`;
- export `IntegrationsGithubService` alongside `IntegrationsKeyRotationService`.

Update the module doc comment to match. Re-export the public types and `walkAddCandidates` from one entry file, `integrations/integrations-github.public.ts`, which is what #463's ESLint override will allow.

## Deletion event (`integrations.md#deletion-hook`, emitter side)

- Add `integrations/integration-deleted.event.ts`, which defines `INTEGRATION_DELETED = 'integration.deleted'` and `IntegrationDeletedEvent { userId, integrationId }`. Export the event type from the public entry file.
- In `IntegrationsService.delete`:
  1. after `store.deleteOwned` commits, evict the cached token;
  2. then `await this.eventEmitter.emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(row.userId, row.id))`.
  - A listener failure never fails the delete; `@OnEvent` suppresses errors by default. Wrap the call defensively and log safe fields only.

## Files to Change

- `backend/src/integrations/integrations-github.service.ts`: new.
- `backend/src/integrations/add-candidate-walk.ts`: new.
- `backend/src/integrations/integrations-github.public.ts`: new; the public entry point.
- `backend/src/integrations/integration-deleted.event.ts`: new.
- `backend/src/integrations/integrations.service.ts`: injects `EventEmitter2`; emits the event and evicts the token on delete.
- `backend/src/integrations/integrations.module.ts`: new providers and the new export.
