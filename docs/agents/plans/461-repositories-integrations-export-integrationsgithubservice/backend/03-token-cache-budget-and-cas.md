# Token cache, budget tracker and status compare-and-set

## Status compare-and-set (`integrations.md#status-compare-and-set`)

Add `IntegrationStoreService#setStatusIfCredential(row, ivUsed, status, statusReason)`. It runs:

```sql
UPDATE integrations SET status = ?, status_reason = ?
WHERE id = :id AND user_id = :userId AND secret_iv = :ivUsed
```

It returns `true` when a row changed. `ivUsed` is the `Buffer` read with the row that was decrypted for the call, and it never leaves the module. It is used in these cases:
- `pat` 401 → `invalid` + `bad_credentials`;
- `oauth_app` 401 → `invalid` + `revoked`;
- `github_app` mint 404 → `invalid` + `uninstalled`;
- `github_app` mint 403 → `invalid` + `suspended`;
- decrypt failure → `undecryptable`.

Use the `undecryptable` reason or test-result convention already used by `IntegrationConnectionTestService`.

## Installation-token cache (`integrations.md#github-app-installation-tokens`)

Add `integrations/github-installation-token-cache.ts`, an internal singleton provider:
- **Key and entry:** keyed by `integrations.id`. Each entry is `{ installationId, ivUsed, token: Secret<string>, expiresAt }`.
- **Lifetime:** an entry is reused while `clock.now() < expiresAt − 5 min`. Expired entries are dropped on read.
- **Single-flight:** an in-flight mint promise is stored per integration id and shared by concurrent callers.
- **Replace guard:** when a mint finishes, the integration's current `secret_iv` is re-read (owner-scoped). The token is cached only if that IV still equals `ivUsed`. Otherwise it is used for this call only.
- **Eviction:**
  - `evict(integrationId)` runs on a `401` made with a cached token, on integration delete, and on replace credential. Hook it into `IntegrationsService.delete` and `replaceCredential`.
  - Eviction also applies to the in-flight mint, so a mint started before a Replace is never cached; the Replace guard above covers it.
- **401 retry:**
  - a `401` with a cached token evicts it, mints once and retries the call once;
  - a `401` with a fresh token answers `unavailable` (`unexpected`), is logged with safe fields, and leaves the status unchanged.
- **Mint failures:**
  - `404` → compare-and-set to `invalid` + `uninstalled`, result `invalid_credentials`;
  - `403` → compare-and-set to `invalid` + `suspended`, result `invalid_credentials`;
  - `401` (app JWT rejected) → `unavailable` (`unexpected`), logged at error level;
  - `5xx`, timeout or rate limit → `unavailable` or `rate_limited`, status unchanged.
- **No leaks:** there is no getter that returns the token, and nothing logs it.

## Unauthenticated budget tracker (`integrations.md#unauthenticated-budget-tracker`)

Add `integrations/github-unauthenticated-budget.ts`, holding `GithubUnauthenticatedBudget`, an internal singleton that is not exported:
- `tryAcquire(purpose: 'sync' | 'add')` returns `{ ok: true }` or `{ ok: false, resetAt }`:
  - the thresholds are `sync` ≤ 10 and `add` ≤ 0 (code constants);
  - a granted call decrements the tracked remaining by 1, which reserves it in flight;
  - with no data, or once `clock.now()` is past the reset, every call is allowed until the first response.
- `record(rateLimit)` runs on every unauthenticated response, `304` included:
  - within a window it keeps the minimum `Remaining`;
  - a later `Reset` replaces the window.
- A refused acquire answers `rate_limited` with the window's `resetAt`, and no `fetch` happens.

## Files to Change

- `backend/src/integrations/integration-store.service.ts`: adds `setStatusIfCredential` and a helper that reads the current `secret_iv` (owner-scoped).
- `backend/src/integrations/github-installation-token-cache.ts`: new.
- `backend/src/integrations/github-unauthenticated-budget.ts`: new.
- `backend/src/integrations/integrations.service.ts`: evicts the cached token on delete and on replace credential.
