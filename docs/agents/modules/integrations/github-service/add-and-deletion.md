# Integrations — GitHub service: Add, deletion hook and budget tracker

Part of the [GitHub service](../github-service.md) of the [Integrations module](../../integrations.md).

## Access link on Add

When the user adds a repository ([routes](../../../backend/routes/repositories/refresh-and-add.md#add)):

- Among the **usable** integrations that hold a source row for the repo, the **oldest** one whose
  re-check grants the repo is stored as `integration_id`.
- When only the public source sees it, the re-check goes through the user's usable integrations
  (oldest first), then unauthenticated. That integration is **not** linked while the repo is
  still public; if the re-check shows the repo is now **private**, the integration that granted
  it is linked as `integration_id`, so the private metadata stays tied to it.
- **Ownership guard:** the link written is always one of the **caller's own** integrations. The
  Repositories service checks the chosen `integration_id` against the user's integrations
  (`listIntegrations(userId)`, usable or not) right before the write; an id that is not the
  user's (another user's, or deleted meanwhile) is stored as **`null`**, never rejected, and
  the Add still succeeds. The empty link is then filled at the end of the next sync like any
  other ([link fill](../../repositories/sync/write-path.md#link-fill)).
- Changing an existing link later is out of scope. An **empty or dangling** link of an added
  private repo (its integration deleted, or a public repo turned private) is filled at the end of
  the next sync with the oldest usable integration that returns it
  ([link fill](../../repositories/sync/write-path.md#link-fill)). This amends the product decision (#444), which left such a repo Unavailable for
  good.

### Add re-check candidates

Add walks candidates in order, with **at most 3 GitHub calls** per Add:

1. the usable integrations holding a source row for the repo, oldest first;
2. when the handle source sees the repo: the remaining usable integrations, oldest first, then
   the unauthenticated path (under [Add's threshold](#unauthenticated-budget-tracker)).

- `401` / `403` / `404` → the next candidate (a `401` also sets a `pat` / `oauth_app` integration
  `invalid`, [invalid on 401](status-and-errors.md#invalid-on-401)).
- Rate limit, timeout, `5xx`, redirect → **stop**: `503 GITHUB_RATE_LIMITED` / `502
  GITHUB_UNAVAILABLE`, no fallback (as for the handle source).
- No candidate left, or the cap reached, after denials → `404 NOT_FOUND`.
- **No candidate at all**, before any GitHub call (every source holding the repo is a non-usable
  integration: `expired`, `invalid`, `undecryptable` or type disabled; and the handle source does
  not hold it) → `409 REPOSITORY_SOURCE_UNUSABLE`, nothing written ([routes](../../../backend/routes/repositories/refresh-and-add.md#add)).

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
  not-added repos left with no source row ([data model](../../repositories/data-model.md#logical-foreign-keys)). Its first
  statement locks the user's sync-state row (`SELECT … FOR UPDATE`), the lock order of every
  multi-table Repositories write transaction, so a cleanup during a sync serializes with the run's page
  writes instead of deadlocking with them ([sync](../../repositories/sync/write-path.md#write-path)).
- **Failure never blocks the delete:** the listener catches its own error and logs it with safe
  fields (`@OnEvent`'s default `suppressErrors: true` keeps `emitAsync` resolving either way); the
  integration delete is already committed and the `204` stands (same best-effort rule as
  `onDelete`).
- **Registered at boot:** the listener lives in a provider instantiated at application start
  (not in a lazily loaded module), so a delete before the first Repositories request still
  reaches it.
- **Safety net:** the end-of-sync transaction drops, user-scoped, the rows of any
  `integration:<id>` key not among all the user's integrations (usable or not), covering a failed listener and a parallel sync writing
  after the cleanup ([sync](../../repositories/sync/write-path.md#write-path)).
- Inside Integrations, the delete also evicts the cached installation token.
- There is no database cascade between the two modules. User deletion goes through a separate
  awaited `user.deleted` event ([data model](../../repositories/data-model.md#user-deletion)); the user's integrations
  cascade without emitting `integration.deleted`, and that listener covers their rows.

## Unauthenticated budget tracker

The behaviour is [sync](../../repositories/sync/github-limits.md#rate-limits)'s (process-wide, in memory, min `Remaining`
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
- **Time:** "reset passed" reads the injected `Clock` (`core/clock.ts`,
  [sync](../../repositories/sync/execution.md#time-source)), never `Date.now()` directly.
- **Two thresholds** (code constants): the **sync** stops at remaining **≤ 10**; **Add** only at
  **≤ 0**. The 10 is then really a reserve for Add re-checks, which are already bounded per user
  (30 per 60 s) and by the 3-call candidate walk.

