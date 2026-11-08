# Issue: Specs: repositories — Integrations GitHub client

## Description

Part of Epic #444 (repositories listing). Spec-enhancement sub-issue, after #445 (feature definition), #446 (API contract) and #447 (sync engine), all merged.

Today the Integrations module (`docs/agents/modules/integrations.md`) exports nothing and only calls GitHub to validate or test a credential and to list GitHub App installations. This issue settles the **Integrations GitHub client** the Repositories module uses, in `docs/agents/specs/repos/integrations.md`, with knock-ons in `security.md`, `sync.md`, `model.md` and `api.md`.

Specs only: no code changes.

## Problem

The repos specs leave the Integrations side open, in "Open — settled by #448" notes:

- `integrations.md`: the exported interface, per-type authentication (including GitHub App installation-token minting and caching), the endpoint and parameters per type, the error mapping, whether Add tries the next candidate after a `401`, where the shared `502`/`503` helpers live, which statuses count as usable, and the deletion-hook mechanism.
- `sync.md`: the endpoint per integration type and for the handle; which statuses count as usable for the handle credential; the home of the unauthenticated budget tracker.
- `model.md`: the deletion-hook mechanism (direct call vs event).
- `api.md`: Add's candidate walk after a `401`, and where the `502`/`503` helpers live.
- `security.md`: the guarantees of the exported interface.

Two inconsistencies also need fixing: `security.md` places the unauthenticated client in the Repositories module while `sync.md` puts the budget tracker in the Integrations client, and `sync.md` calls the unauthenticated threshold "a reserve for Add re-checks" while `security.md` makes Add honour the same threshold.

## Expected Behavior

- `docs/agents/specs/repos/integrations.md` documents every decision in Solution (interface, unauthenticated calls, endpoints, installation tokens, usable integrations, error mapping, shared helpers, deletion hook, budget tracker) and replaces each of its "Open — settled by #448" notes.
- `security.md` states that credentials and minted installation tokens never leave the Integrations module, that a single client in the Integrations module serves both authenticated and unauthenticated calls, and that Add uses its own threshold (≤ 0), not the sync's.
- `sync.md` gets the endpoints per source, the usable-status rules for sources and the handle, the end-of-sync safety net for deleted integrations, and the two thresholds (values table and rate limits).
- `model.md` and `api.md` resolve their #448 notes: the `integration.deleted` event, the Add candidate walk (3-call cap), and the `502`/`503` helpers in `core/`.
- `README.md`: the decisions summary gains the #448 decisions; the #448 rows leave "Open markers"; the sub-issues row for #448 adds `api.md`; "Product changes folded by #452" gains the `modules/integrations/github-app.md` change (installation tokens cached in memory for repo calls, instead of minted per use).
- Every "Open — settled by #448" note in `docs/agents/specs/repos/` is gone (`grep` finds none).
- No code changes.

### Required tests

Added to `integrations.md`'s "Required tests" (and to the matching `security.md` / `sync.md` lists where they belong):

- The exported service never returns, logs or exposes a decrypted credential, a minted installation token or a GitHub response body.
- A missing or foreign `integrationId` answers `integration_unusable` without a GitHub call.
- Each operation calls exactly its fixed endpoint and parameters (per type, the handle, the re-check), builds its own page URL, and reads `Link` only for `rel="next"`.
- `integrationId: null` sends no `Authorization` header.
- Malformed repo entries are dropped; a listing body over 2 MiB answers `unavailable`.
- Each row of the error-mapping table yields its result kind and its effect on the integration status; rate limits are detected from headers only.
- `3xx` (other than `304`) is never followed and answers `unavailable` (`redirect`).
- Installation tokens: one mint serves concurrent calls; a cached token is reused until `expires_at` − 5 min; it is minted with `metadata: read` only; it is evicted on `401`, delete and replace credential; a `401` with a cached token re-mints and retries once, and a `401` with a fresh token answers `unavailable` without changing the status; mint `404`/`403`/app-JWT `401` map as specified.
- Non-usable integrations (`expired`, `invalid`, `undecryptable`, type disabled) are never called; the sync records `invalid_credentials` or `error` and keeps their rows.
- `listUsableIntegrations` returns only usable integrations, oldest first, filtered by `user_id` in the query.
- Add's candidate walk: `401`/`403`/`404` move to the next candidate; a rate limit, timeout, `5xx` or redirect stops it; it never makes more than 3 GitHub calls; denials everywhere answer `404`.
- Budget tracker: concurrent acquires reserve the budget (no overshoot); the sync is refused at ≤ 10, Add only at ≤ 0; a refused acquire makes no GitHub call; out-of-order responses never raise the budget.
- Deleting an integration emits `integration.deleted` after the delete commits; the listener's cleanup is user-scoped; a listener failure is logged and the delete still answers `204`; the end-of-sync safety net drops rows of a deleted integration written by a concurrent sync.
- The `502`/`503` helpers answer the same codes, messages and statuses from `core/` as before the move.

## Solution

Decided during `/enhance-issue 448`.

### Interface shape

The Integrations module exports **`IntegrationsGithubService`** (from `IntegrationsModule`), with
fixed, `GET`-only operations — no generic `request(path)`:

```ts
// Oldest first (created_at, then id); filtered by userId in the query.
listUsableIntegrations(userId): Promise<IntegrationRef[]>   // { id, uuid, label, type }

listRepositories(userId, integrationId, page, etag?): Promise<RepoPageResult>
listHandleRepositories(userId, integrationId | null, handle, page, etag?): Promise<RepoPageResult>
getRepository(userId, integrationId | null, githubId): Promise<RepoResult>
```

- **Integration identity:** callers pass the internal `integrations.id` (the logical FK the
  Repositories tables already store). Every call loads it with `WHERE id = ? AND user_id = ?`; a
  missing or foreign one answers `integration_unusable` with no GitHub call. `null` means
  unauthenticated (see "Unauthenticated calls").
- **Typed, normalised results**, never a raw `Response`:

  ```ts
  type RepoPageResult =
    | { kind: 'ok'; repos: GithubRepo[]; etag: string | null; hasNext: boolean; rateLimit: RateLimitFields }
    | { kind: 'not_modified'; rateLimit: RateLimitFields }   // 304: the caller reuses its stored has_next
    | { kind: 'invalid_credentials' }                        // 401: the integration is already set invalid
    | { kind: 'rate_limited'; resetAt: Date | null }
    | { kind: 'unavailable'; reason: 'timeout' | 'network_error' | 'server_error' | 'redirect' | 'unexpected' }
    | { kind: 'integration_unusable' };                     // missing, foreign, undecryptable or not usable

  type RepoResult =
    | { kind: 'ok'; repo: GithubRepo }
    | { kind: 'not_found' }
    | /* the same failure kinds as RepoPageResult */;

  type GithubRepo = { githubId: number; owner: string; name: string; private: boolean };
  ```

- `GithubRepo` carries only the model's fields. Each entry is validated (`githubId` a positive
  integer below 2⁵³, `owner` ≤ 39 and `name` ≤ 100 characters); malformed entries are dropped,
  as `GET /user/installations` entries are today.
- The service builds every page URL from `page` itself; `hasNext` is whether `Link` has a
  `rel="next"`, whose URL is never used.
- Credentials, minted tokens and GitHub response bodies never leave the module.

### Unauthenticated calls

**Every GitHub call of the feature, authenticated or not, goes through the Integrations module's
GitHub client.**

- `integrationId: null` on `listHandleRepositories` / `getRepository` sends the request with no
  `Authorization` header.
- The process-wide **unauthenticated budget tracker** lives next to that client, inside
  Integrations. Callers (the sync, Add's re-check) only see its effect: an unauthenticated call
  under the threshold answers `rate_limited` without calling GitHub.
- Why: `GithubClientService` is already "the only place in the backend that calls GitHub", with
  the safeguards (no redirects, timeout, body cap, pinned API version) and the single seam tests
  fake. A second client in Repositories would duplicate both and split the tracker's home.
  Repositories holds no HTTP code; it only consumes typed results.
- Knock-on: `security.md` "Fixed GitHub base URL" drops "the unauthenticated one (Repositories)"
  and says a single client in the Integrations module serves both, with or without a credential.

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
  which the sync's page rewrite already handles.
- **Explicit `affiliation` / `visibility`** (GitHub's defaults) pin the meaning: private and
  organization repos included. A fine-grained PAT returns only the repos it was granted; an OAuth
  App sees an organization's private repos only once that organization approved it
  (`oauth-app.md`).
- **Handle `type=owner`:** the handle's own repos only. The handle source still keeps only
  `private: false`.
- **Field mapping:** `id` → `githubId`, `owner.login` → `owner`, `name`, `private`; the rest of the
  body is discarded.
- **Body cap:** 2 MiB for repo listings (a page of 100 repo objects is ~0.5–1 MB, over today's
  64 KiB `GET /user` cap); 64 KiB for `GET /repositories/{id}`. Over the cap → `unavailable`
  (`unexpected`).

### GitHub App installation tokens

Minting per request (today's `github-app.md` rule) would double the calls of a sync (up to 10
pages per source, plus the handle and Add re-checks) and spend the app JWT's rate limit. So repo
calls use an **in-memory cache inside the Integrations module**:

- **Key and lifetime:** keyed by `integrations.id` (recording its `installationId`); a token is
  reused until **`expires_at` − 5 min** (GitHub's tokens last 1 h). Held in a `Secret`, in
  process memory only — never in the database, a log or a response. Expired entries are dropped
  on read; at most one entry per `github_app` integration, so no LRU.
- **Single-flight:** concurrent calls for one integration share one in-flight mint (the sync runs
  3 sources in parallel, and the handle may use the same integration).
- **Least privilege:** minted with `{"permissions": {"metadata": "read"}}`, enough to list repos
  and read one by id. A later feature (e.g. the issue proxy) widens it when it needs to.
- **Eviction:** on a `401` from a call made with it, on integration delete, on replace credential.
- **401 retry:** a `401` with a *cached* token evicts it, mints once and retries the call **once**;
  a `401` with a **freshly minted** token (the retry, or a first call) answers `unavailable`
  (`unexpected`), logged with safe fields, status unchanged: the mint succeeded, so the
  installation exists. **Only a mint `404`/`403` invalidates a `github_app` integration**; a token
  revoked or rotated server-side never does.
- **Mint failures** (same mapping as the GitHub App test connection):

  | Mint answer | Integration | Result |
  |---|---|---|
  | `404` | `invalid` + `uninstalled` | `invalid_credentials` |
  | `403` | `invalid` + `suspended` | `invalid_credentials` |
  | `401` (app JWT rejected) | unchanged — server misconfiguration | `unavailable` (`unexpected`), logged at error level with safe fields |
  | `5xx`, timeout, rate limit | unchanged | `unavailable` / `rate_limited` |

- **Knock-on:** this supersedes `github-app.md`'s "minted per use" for repo calls; #452 updates
  that page when folding the specs. Test connection keeps minting fresh and dropping the token, so
  it checks the real state.

### Usable integrations

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
- **`invalid`:** the module's rule stands — nothing polls; the status changes only on an explicit
  test connection. The user fixes it with Test or Replace on the Integrations page; retrying on
  every sync would waste a call per broken credential.
- **`undecryptable`:** cannot be called. An `active` row that fails to decrypt during a call is
  set `undecryptable` (existing transition) and answers `integration_unusable`.
- **Type disabled:** the server's configuration, not the user's credential, so `error`.
- A non-usable source is a *failed* source: its earlier rows and pages are kept (partial-failure
  rule), so its repos stay listed until the integration is fixed or deleted (#450 may revisit).
- `listUsableIntegrations` returns only usable ones, oldest first. The sync builds its sources
  from **all** the user's integrations; the handle and Add use the usable list.
- `integration_unusable` carries a reason, `'status' | 'type_disabled'`, so the sync maps it to
  `invalid_credentials` or `error`; the reason never reaches a response.

### Error mapping

One table in the client, for every call:

| GitHub answer | Result | Integration |
|---|---|---|
| `200`, well-formed body | `ok` | — |
| `304` (listings) | `not_modified` | — |
| `401`, authenticated | `invalid_credentials` | set `invalid` + the type's existing bad-credentials reason (`pat`, `oauth_app`; a `github_app` call `401` never invalidates — see "GitHub App installation tokens") |
| `403` / `429` with `X-RateLimit-Remaining: 0` or a `Retry-After` | `rate_limited`, `resetAt` from `X-RateLimit-Reset` or now + `Retry-After` | unchanged |
| any other `403` | listings: `unavailable` (`forbidden`); `getRepository`: `not_found` (denied) | unchanged — the user re-checks with Test |
| `404` | `getRepository` and the handle listing: `not_found`; other listings: `unavailable` (`unexpected`) | unchanged |
| `3xx` other than `304` | `unavailable` (`redirect`) — `redirect: 'manual'`, so it is classified, never followed | unchanged |
| `5xx` | `unavailable` (`server_error`) | unchanged |
| timeout / network failure | `unavailable` (`timeout` / `network_error`) | unchanged |
| other `4xx`, malformed or oversized body, a `401` without a credential | `unavailable` (`unexpected`) | unchanged |

- Rate limits are detected from **headers only**. No body is parsed for messages, echoed or
  logged; logs carry safe fields only (integration id, operation, HTTP status, result kind).
- The handle listing's `not_found` (a renamed or deleted handle) maps to the source status
  `error` for now; #450 may add a dedicated one.
- `unavailable` reasons never reach a response; the sync maps them to `error`, Add to
  `502 GITHUB_UNAVAILABLE`.

#### Add re-check candidates

Add walks candidates in order, with **at most 3 GitHub calls** per Add:

1. the usable integrations holding a source row for the repo, oldest first;
2. when the handle source sees the repo: the remaining usable integrations, oldest first, then
   the unauthenticated path (under the threshold).

- `401` / `403` / `404` → the next candidate (a `401` also sets the integration `invalid`).
- Rate limit, timeout, `5xx`, redirect → **stop**: `503 GITHUB_RATE_LIMITED` / `502
  GITHUB_UNAVAILABLE`, no fallback (as for the handle source).
- No candidate left, or the cap reached, after denials → `404 NOT_FOUND`.
- This pins down api.md's "denied (`404`/`403`) from every candidate" and bounds it.

### Shared 502 / 503 helpers

`githubUnavailable()` (`502 GITHUB_UNAVAILABLE`) and `githubRateLimited(retryAfterSeconds?)`
(`503 GITHUB_RATE_LIMITED`) **move from `integrations/integration-http-errors.ts` to
`core/github-http-errors.ts`**, next to their codes in `core/error-codes.ts`.

- `integration-http-errors.ts` imports them from `core/`; its `httpErrorFor` is unchanged, and so
  is the response contract (codes, messages, statuses, `retryAfterSeconds`).
- Repositories imports them from `core/`, never from Integrations' HTTP layer. The Integrations
  module's only cross-module surface stays `IntegrationsGithubService`; HTTP exceptions stay a
  controller-layer concern.
- The move is mechanical, with no behaviour change, and is done by the implementation issue,
  not by this specs issue.

### Deletion hook

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
  not-added repos left with no source row.
- **Failure never blocks the delete:** logged with safe fields; the `204` stands (same
  best-effort rule as `onDelete`).
- **Safety net in the sync:** before pruning, the end-of-sync transaction drops the source, page
  and status rows of any `integration:<id>` key no longer among the user's integrations. It covers
  a failed listener and a sync running in parallel that writes a page for the integration after
  the cleanup. A dangling `integration_id` already reads as empty (`model.md`).
- Inside Integrations, the delete also evicts the cached installation token.
- User deletion stays #450's (it may reuse a `user.deleted` event; not decided here).

### Unauthenticated budget tracker

The behaviour fixed by #447 stands (`sync.md`: process-wide, in memory, min `Remaining` within a
reset window, window replaced only on a later `Reset`, consulted before every unauthenticated
call). #448 settles its home, interface, concurrency and thresholds:

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
  (30 per 60 s) and by the 3-call candidate walk. `sync.md` (values table, rate limits) and
  `security.md` ("the unauthenticated re-check honours the low-budget threshold") are reworded to
  match.

## Benefits

- One narrow, typed, `GET`-only surface between Repositories and Integrations: credentials and tokens stay in one module, and Repositories holds no HTTP code.
- All GitHub traffic keeps going through one client with the existing safeguards (no redirects, timeout, body cap, pinned API version), and a single seam to fake in tests.
- Fewer GitHub calls: cached installation tokens, ETag-friendly `sort=created` pagination, and no calls to integrations known to be unusable.
- The shared unauthenticated budget gets a real reserve for Add, without overshoot from parallel calls.
- Deleting an integration cleans up without a circular module dependency, with a safety net if the cleanup fails.
