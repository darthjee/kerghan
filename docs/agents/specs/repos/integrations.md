# Repositories — Integrations module

What the Repositories feature needs from the [Integrations module](../../modules/integrations.md),
which exports nothing today. Part of the [Repositories specs](README.md).

## Exported service

The Integrations module exports **`IntegrationsGithubService`** (from `IntegrationsModule`), with
fixed, `GET`-only operations; there is no generic `request(path)`:

```ts
// Oldest first (created_at, then id); filtered by userId in the query.
listUsableIntegrations(userId): Promise<IntegrationRef[]>   // { id, uuid, label, type }

listRepositories(userId, integrationId, page, etag?): Promise<RepoPageResult>
listHandleRepositories(userId, integrationId | null, handle, page, etag?): Promise<RepoPageResult>
getRepository(userId, integrationId | null, githubId): Promise<RepoResult>
```

- **Integration identity:** callers pass the internal `integrations.id` (the logical FK the
  Repositories tables already store, [model.md](model.md#logical-foreign-keys)). Every call loads
  it with `WHERE id = ? AND user_id = ?`; a missing or foreign one answers
  `integration_unusable` with reason `missing` and **no GitHub call**. `null` means unauthenticated
  ([unauthenticated calls](#unauthenticated-calls)).
- **Typed, normalised results**, never a raw `Response`:

  ```ts
  type RepoPageResult =
    | { kind: 'ok'; repos: GithubRepo[]; etag: string | null; hasNext: boolean; rateLimit: RateLimitFields }
    | { kind: 'not_modified'; rateLimit: RateLimitFields }   // 304: the caller reuses its stored has_next
    | { kind: 'invalid_credentials' }                        // 401: the integration is already set invalid
    | { kind: 'rate_limited'; resetAt: Date | null }
    | { kind: 'unavailable'; reason: 'timeout' | 'network_error' | 'server_error' | 'redirect' | 'forbidden' | 'unexpected' }
    | { kind: 'integration_unusable'; reason: 'status' | 'type_disabled' | 'missing' }; // not usable, type disabled, or missing / foreign

  type RepoResult =
    | { kind: 'ok'; repo: GithubRepo }
    | { kind: 'not_found' }
    | /* the same failure kinds as RepoPageResult */;

  type GithubRepo = { githubId: number; owner: string; name: string; private: boolean };
  ```

- `GithubRepo` carries only the model's fields. Each entry is validated (`githubId` a positive
  integer below 2⁵³, `owner` ≤ 39 and `name` ≤ 100 characters); malformed entries are dropped,
  as `GET /user/installations` entries are today.
- **Pagination:** the service builds every page URL from `page` itself
  (`?per_page=100&page=N`); `hasNext` is whether `Link` has a `rel="next"`, whose URL is never
  used ([security.md](security.md#fixed-github-base-url)).
- **Conditional requests:** a passed `etag` is sent as `If-None-Match`; the response's `ETag`
  and `X-RateLimit-*` come back in the result ([sync.md](sync.md#conditional-requests)).
- Every request has the existing 10 s timeout ([sync.md](sync.md#values)).
- **Credentials, minted installation tokens and GitHub response bodies never leave the module**:
  the Repositories module never sees, stores or logs them
  ([security.md](security.md#credentials-stay-in-the-backend)).
- Integration types in scope: `pat`, `oauth_app`, `github_app`.
- The handle source's credential walk (oldest usable integration, the next one after a `401`,
  then unauthenticated; no fallback on a rate limit, timeout or `5xx`) is the sync's, built on
  `listUsableIntegrations` ([sync.md](sync.md#handle-credential)).

### Unauthenticated calls

**Every GitHub call of the feature, authenticated or not, goes through the Integrations module's
GitHub client.**

- `integrationId: null` on `listHandleRepositories` / `getRepository` sends the request with no
  `Authorization` header.
- The process-wide [unauthenticated budget tracker](#unauthenticated-budget-tracker) lives next
  to that client, inside Integrations. Callers (the sync, Add's re-check) only see its effect: an
  unauthenticated call under the threshold answers `rate_limited` without calling GitHub.
- Why: `GithubClientService` is already "the only place in the backend that calls GitHub", with
  the safeguards (no redirects, timeout, body cap, pinned API version) and the single seam tests
  fake. A second client in Repositories would duplicate both and split the tracker's home.
  Repositories holds no HTTP code; it only consumes typed results.

### Endpoints and parameters

Every listing adds `per_page=100&page=N` (URL built by the client, never taken from a response),
with the already-pinned `Accept` and `X-GitHub-Api-Version` headers.

| Source | Auth | Endpoint |
|---|---|---|
| `pat`, `oauth_app` | `Bearer <token>` | `GET /user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=created&direction=asc` |
| `github_app` | `Bearer <installation token>` | `GET /installation/repositories` (body `{ total_count, repositories: [...] }`; no sort parameter) |
| Handle | oldest usable integration, or none | `GET /users/{handle}/repos?type=owner&sort=created&direction=asc` (handle URL-encoded) |
| Add re-check | the access integration, or none | `GET /repositories/{githubId}` |

- **`sort=created&direction=asc`** rather than the default `full_name`: with page-number
  pagination a new repo lands on the last page, so earlier pages keep their ETag (`304`); a name
  sort would shift every page boundary on any creation or rename. Deletions still shift pages,
  which the sync's page rewrite already handles ([sync.md](sync.md#write-path)).
- **Explicit `affiliation` / `visibility`** (GitHub's defaults) pin the meaning: private and
  organization repos included. A fine-grained PAT returns only the repos it was granted; an OAuth
  App sees an organization's private repos only once that organization approved it
  ([oauth-app.md](../../modules/integrations/oauth-app.md)).
- **Handle `type=owner`:** the handle's own repos only. The handle source still keeps only
  `private: false` ([sync.md](sync.md#sources)).
- **Field mapping:** `id` → `githubId`, `owner.login` → `owner`, `name`, `private`; the rest of the
  body is discarded.
- **Body cap:** 2 MiB for repo listings (a page of 100 repo objects is ~0.5–1 MB, over today's
  64 KiB `GET /user` cap); 64 KiB for `GET /repositories/{id}`. Over the cap → `unavailable`
  (`unexpected`).

### GitHub App installation tokens

Minting per request (today's [github-app.md](../../modules/integrations/github-app.md) rule)
would double the calls of a sync (up to 10 pages per source, plus the handle and Add re-checks)
and spend the app JWT's rate limit. So repo calls use an **in-memory cache inside the
Integrations module**:

- **Key and lifetime:** keyed by `integrations.id` (recording its `installationId`); a token is
  reused until **`expires_at` − 5 min** (GitHub's tokens last 1 h). Held in a `Secret`, in
  process memory only — never in the database, a log or a response. Expired entries are dropped
  on read; at most one entry per `github_app` integration, so no LRU.
- **Single-flight:** concurrent calls for one integration share one in-flight mint (the sync runs
  3 sources in parallel, and the handle may use the same integration).
- **Least privilege:** minted with `{"permissions": {"metadata": "read"}}`, enough to list repos
  and read one by id. A later feature (e.g. the issue proxy) widens it when it needs to.
- **Eviction:** on a `401` from a call made with it, on integration delete, on replace credential.
- **Mint invalidation is a compare-and-set:** a mint `404` / `403` sets the integration `invalid`
  only if its credential is still the one used for the mint
  ([compare-and-set](#status-compare-and-set)).
- **401 retry:** a `401` with a *cached* token evicts it, mints once and retries the call
  **once**; a `401` with a **freshly minted** token (the retry, or a first call) answers
  `unavailable` (`unexpected`), logged with safe fields, status unchanged: the mint succeeded, so
  the installation exists. **Only a mint `404`/`403` invalidates a `github_app` integration**; a
  token revoked or rotated server-side never does.
- **Mint failures** (same mapping as the GitHub App test connection):

  | Mint answer | Integration | Result |
  |---|---|---|
  | `404` | `invalid` + `uninstalled` | `invalid_credentials` |
  | `403` | `invalid` + `suspended` | `invalid_credentials` |
  | `401` (app JWT rejected) | unchanged — server misconfiguration | `unavailable` (`unexpected`), logged at error level with safe fields |
  | `5xx`, timeout, rate limit | unchanged | `unavailable` / `rate_limited` |

- This supersedes `github-app.md`'s "minted per use" for repo calls; #452 updates that page
  ([README.md](README.md#product-changes-folded-by-452)). Test connection keeps minting fresh and
  dropping the token, so it checks the real state.

## Invalid on 401

A `401` from GitHub on a request made through a `pat` or `oauth_app` integration sets that
integration's status to `invalid`, with the type's existing bad-credentials reason (the same as
its test connection), inside the Integrations module. A `github_app` call's `401` never
invalidates; only a mint `404`/`403` does
([installation tokens](#github-app-installation-tokens)). Transient failures (network errors,
`5xx`, rate limits) never change the status, as for test connection today.

### Status compare-and-set

Every status change caused by a repo call is conditional on the credential that call used:

- a `pat` / `oauth_app` `401` ⇒ `invalid`;
- a `github_app` mint `404` / `403` ⇒ `invalid`;
- a decrypt failure ⇒ `undecryptable`.

```sql
UPDATE integrations SET status = …, status_reason = …
WHERE id = :id AND user_id = :userId AND secret_iv = :ivUsed
```

- `secret_iv` is fresh on every encryption, so a Replace, or a key rotation, between the call and
  the write makes the write a no-op: a freshly replaced credential is never marked `invalid` by a
  request made with the old one.
- No new column. A missed invalidation after a key rotation recurs on the next call.
- `:ivUsed` stays inside the Integrations module: it never reaches Repositories, a response or a
  log ([security.md](security.md#credentials-stay-in-the-backend)).

## Usable integrations

**An integration is usable when its reported status is `active` and its type is enabled on this
server** (a `github_app` integration is unusable when the app's server config is missing).

| Reported status | Sync source | Handle / Add candidate |
|---|---|---|
| `active` | called | yes |
| `expired` | listed, **no call**, status `invalid_credentials` | no |
| `invalid` | listed, **no call**, status `invalid_credentials` | no |
| `undecryptable` | listed, **no call**, status `invalid_credentials` | no |
| any, type disabled | listed, **no call**, status `error` | no |

- **`expired`:** GitHub would answer `401`, and the 401 rule would overwrite the precise `expired`
  with `invalid` + `bad_credentials`.
- **`invalid`:** nothing polls and an `invalid` integration is never retried by a sync; it
  returns to `active` only through Test or Replace on the Integrations page. Retrying on every
  sync would waste a call per broken credential.
- **`undecryptable`:** cannot be called. An `active` row that fails to decrypt during a call is
  set `undecryptable` (existing transition) and answers `integration_unusable`.
- **Type disabled:** the server's configuration, not the user's credential, so `error`.
- A non-usable source is a *failed* source: its earlier rows and pages are kept
  ([partial failures](sync.md#partial-failures)), so its repos stay listed until the integration
  is fixed or deleted. **Accepted:** they hold only the user's own data, visible only to that
  user; the banner says to fix the integration, and deleting it purges its rows at once.
  Rejected: expiring them (for example after 30 days), since added repos would flip to
  Unavailable and a fixed token would re-import everything.
- A fixed integration (Test or Replace returns it to `active`) reads `pending` until its next
  sync ([api.md](api.md#sync-state)).
- `listUsableIntegrations` returns only usable ones, oldest first, filtered by `user_id` in the
  query. The sync builds its sources from **all** the user's integrations; the handle and Add use
  the usable list.
- `integration_unusable` carries a reason, `'status' | 'type_disabled' | 'missing'`, so the sync
  maps it to `invalid_credentials`, `error`, or, for `missing` (no integration row for that id and
  user, e.g. deleted mid-sync), stops that source with **no status**
  ([sync.md](sync.md#sources)); the reason never reaches a response.

## Error mapping

One table in the client, for every call:

| GitHub answer | Result | Integration |
|---|---|---|
| `200`, well-formed body | `ok` | — |
| `304` (listings) | `not_modified` | — |
| `401`, authenticated | `invalid_credentials` | set `invalid` + the type's existing bad-credentials reason, as a [compare-and-set](#status-compare-and-set) (`pat`, `oauth_app`; a `github_app` call `401` never invalidates — see [installation tokens](#github-app-installation-tokens)) |
| `403` / `429` with `X-RateLimit-Remaining: 0` or a `Retry-After` | `rate_limited`, `resetAt` from `X-RateLimit-Reset` or now + `Retry-After` | unchanged |
| any other `403` | listings: `unavailable` (`forbidden`); `getRepository`: `not_found` (denied) | unchanged — the user re-checks with Test |
| `404` | `getRepository` and the handle listing: `not_found`; other listings: `unavailable` (`unexpected`) | unchanged |
| `3xx` other than `304` | `unavailable` (`redirect`) — the repo operations pass `redirect: 'manual'`, so it is classified, never followed | unchanged |
| `5xx` | `unavailable` (`server_error`) | unchanged |
| timeout / network failure | `unavailable` (`timeout` / `network_error`) | unchanged |
| other `4xx`, malformed or oversized body, a `401` without a credential | `unavailable` (`unexpected`) | unchanged |

- **Redirect option:** `GithubClientService#send` gains a `redirect` option defaulting to today's
  `'error'`; only the new repo operations pass `'manual'`, so the existing callers (`GET /user`,
  OAuth exchange/revoke, GitHub App calls) keep mapping a `3xx` to `network_error` unchanged.
  Neither mode follows a redirect.
- Rate limits are detected from **headers only**. No body is parsed for messages, echoed or
  logged; logs carry safe fields only (integration id, operation, HTTP status, result kind).
- The handle listing's `not_found` (an unknown, renamed, suspended or deleted handle) maps to the
  source status **`not_found`**, with no fallback to another credential
  ([sync.md](sync.md#handle-credential)).
- `unavailable` reasons never reach a response; the sync maps them to `error`, Add to
  `502 GITHUB_UNAVAILABLE`.

## Access link on Add

When the user adds a repository ([api.md](api.md#add)):

- Among the **usable** integrations that hold a source row for the repo, the **oldest** one whose
  re-check grants the repo is stored as `integration_id`.
- When only the public source sees it, the re-check goes through the user's usable integrations
  (oldest first), then unauthenticated. That integration is **not** linked while the repo is
  still public; if the re-check shows the repo is now **private**, the integration that granted
  it is linked as `integration_id`, so the private metadata stays tied to it.
- Changing a set, valid link later is out of scope. An **empty or dangling** link of an added
  private repo (its integration deleted, or a public repo turned private) is filled at the end of
  the next sync with the oldest usable integration that returns it
  ([link fill](sync.md#link-fill)); that is not a change of a valid link.

### Add re-check candidates

Add walks candidates in order, with **at most 3 GitHub calls** per Add:

1. the usable integrations holding a source row for the repo, oldest first;
2. when the handle source sees the repo: the remaining usable integrations, oldest first, then
   the unauthenticated path (under [Add's threshold](#unauthenticated-budget-tracker)).

- `401` / `403` / `404` → the next candidate (a `401` also sets a `pat` / `oauth_app` integration
  `invalid`, [invalid on 401](#invalid-on-401)).
- Rate limit, timeout, `5xx`, redirect → **stop**: `503 GITHUB_RATE_LIMITED` / `502
  GITHUB_UNAVAILABLE`, no fallback (as for the handle source).
- No candidate left, or the cap reached, after denials → `404 NOT_FOUND`.
- **No candidate at all**, before any GitHub call (every source holding the repo is a non-usable
  integration: `expired`, `invalid`, `undecryptable` or type disabled; and the handle source does
  not hold it) → `409 REPOSITORY_SOURCE_UNUSABLE`, nothing written ([api.md](api.md#add)).

## Shared 502 / 503 helpers

`githubUnavailable()` (`502 GITHUB_UNAVAILABLE`) and `githubRateLimited(retryAfterSeconds?)`
(`503 GITHUB_RATE_LIMITED`) **move from `integrations/integration-http-errors.ts` to
`core/github-http-errors.ts`**, next to their codes in `core/error-codes.ts`.

- `integration-http-errors.ts` imports them from `core/`; its `httpErrorFor` is unchanged, and so
  is the response contract (codes, messages, statuses, `retryAfterSeconds`).
- Repositories imports them from `core/`, never from Integrations' HTTP layer. The Integrations
  module's only cross-module surface stays `IntegrationsGithubService`; HTTP exceptions stay a
  controller-layer concern.
- The move is mechanical, with no behaviour change, and is done by the implementation issue.

## Deletion hook

**An awaited `integration.deleted` event**, on the backend's existing `@nestjs/event-emitter`
(`EventEmitterModule.forRoot()` in `AppModule`; Auth already emits `user.registered` and others).
A direct call would need Integrations to import Repositories, which already imports Integrations
(a circular dependency needing `forwardRef`).

- **Event:** `IntegrationDeletedEvent { userId, integrationId }` (internal id), emitted by the
  Integrations service **after the row delete commits**, with `emitAsync` and awaited — so the
  cleanup is normally done before `DELETE` answers `204`, and the next listing is consistent.
  Unlike Auth's fire-and-forget events, this one is awaited on purpose.
- **Listener:** Repositories' `@OnEvent('integration.deleted')` runs one transaction, every
  statement with `AND user_id = :userId`: delete the source, page and status rows for
  `source_key = 'integration:<id>'`; clear `integration_id` where it points at it; prune
  not-added repos left with no source row ([model.md](model.md#logical-foreign-keys)).
- **Failure never blocks the delete:** the listener catches its own error and logs it with safe
  fields (`@OnEvent`'s default `suppressErrors: true` keeps `emitAsync` resolving either way); the
  integration delete is already committed and the `204` stands (same best-effort rule as
  `onDelete`).
- **Registered at boot:** the listener lives in a provider instantiated at application start
  (not in a lazily loaded module), so a delete before the first Repositories request still
  reaches it.
- **Safety net:** the end-of-sync transaction drops, user-scoped, the rows of any
  `integration:<id>` key not among all the user's integrations (usable or not), covering a failed listener and a parallel sync writing
  after the cleanup ([sync.md](sync.md#write-path)).
- Inside Integrations, the delete also evicts the cached installation token.
- There is no database cascade between the two modules. User deletion goes through a separate
  awaited `user.deleted` event ([model.md](model.md#user-deletion)); the user's integrations
  cascade without emitting `integration.deleted`, and that listener covers their rows.

## Unauthenticated budget tracker

The behaviour is [sync.md](sync.md#rate-limits)'s (process-wide, in memory, min `Remaining`
within a reset window, window replaced only on a later `Reset`, consulted before every
unauthenticated call). Its home, interface, concurrency and thresholds:

- **Home:** an internal singleton provider, `GithubUnauthenticatedBudget`
  (`integrations/github-unauthenticated-budget.ts`), **not exported**. `IntegrationsGithubService`
  consults it whenever `integrationId` is `null`; callers never touch it.

  ```ts
  tryAcquire(purpose: 'sync' | 'add'): { ok: true } | { ok: false; resetAt: Date }
  record(rateLimit: RateLimitFields): void   // every unauthenticated response, 304 included
  ```

  `listHandleRepositories` acquires as `sync`, `getRepository` as `add`. A refused acquire answers
  `rate_limited` with that `resetAt`, with no GitHub call.
- **In-flight reservations:** the sync runs 3 sources in parallel and Adds run concurrently, so
  `tryAcquire` decrements the tracked remaining by 1 when it grants a call; `record` then applies
  the min-within-window rule from GitHub's headers. With no data, or once the reset has passed,
  calls are allowed until the first response.
- **Two thresholds** (code constants): the **sync** stops at remaining **≤ 10**; **Add** only at
  **≤ 0**. The 10 is then really a reserve for Add re-checks, which are already bounded per user
  (30 per 60 s) and by the 3-call candidate walk.

## Required tests

- The exported service never returns, logs or exposes a decrypted credential, a minted
  installation token or a GitHub response body.
- A missing or foreign `integrationId` answers `integration_unusable` with reason `missing`,
  without a GitHub call (a call for an integration deleted mid-sync included).
- Status compare-and-set: a `401` from a call made before a Replace leaves the replaced
  integration `active`; a `401` with the current credential sets it `invalid`; the same holds for
  a mint `404` / `403` and a decrypt failure.
- The handle listing's `404` answers `not_found`.
- Each operation calls exactly its fixed endpoint and parameters (per type, the handle, the
  re-check), builds its own page URL, and reads `Link` only for `rel="next"`.
- `integrationId: null` sends no `Authorization` header.
- Malformed repo entries are dropped; a listing body over 2 MiB answers `unavailable`.
- Each row of the error-mapping table yields its result kind and its effect on the integration
  status; rate limits are detected from headers only.
- `3xx` (other than `304`) is never followed and answers `unavailable` (`redirect`).
- Installation tokens: one mint serves concurrent calls; a cached token is reused until
  `expires_at` − 5 min; it is minted with `metadata: read` only; it is evicted on `401`, delete
  and replace credential; a `401` with a cached token re-mints and retries once, and a `401` with
  a fresh token answers `unavailable` without changing the status; mint `404`/`403`/app-JWT `401`
  map as specified.
- Non-usable integrations (`expired`, `invalid`, `undecryptable`, type disabled) are never
  called; the sync records `invalid_credentials` or `error` and keeps their rows.
- `listUsableIntegrations` returns only usable integrations, oldest first, filtered by `user_id`
  in the query.
- Add's candidate walk: `401`/`403`/`404` move to the next candidate; a rate limit, timeout,
  `5xx` or redirect stops it; it never makes more than 3 GitHub calls; denials everywhere answer
  `404`; no candidate at all answers `409 REPOSITORY_SOURCE_UNUSABLE` with no GitHub call.
- Add links the oldest usable integration that sees and grants the repo. When only the public
  source does, it links none while the repo is public, and links the integration whose re-check
  found it private.
- Budget tracker: concurrent acquires reserve the budget (no overshoot); the sync is refused at
  ≤ 10, Add only at ≤ 0; a refused acquire makes no GitHub call; out-of-order responses never
  raise the budget.
- Deleting an integration emits `integration.deleted` after the delete commits; the listener's
  cleanup is user-scoped; a listener failure is logged and the delete still answers `204`; a
  delete before any Repositories request still runs the cleanup.
- The existing `send` callers keep mapping a `3xx` to `network_error` (`redirect: 'error'`
  default).
- The `502`/`503` helpers answer the same codes, messages and statuses from `core/` as before the
  move.
