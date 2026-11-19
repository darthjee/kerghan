# Repositories — Sync: GitHub Limits

Part of the [Repositories sync](../sync.md) doc, in the [Repositories module](../../repositories.md).

## Rate limits

- Every GitHub response's `X-RateLimit-Remaining` / `X-RateLimit-Reset` are read.
- **`rate_limited` sources are skipped** while their stored `resetAt` is in the future: no call;
  status, `resetAt` and rows are kept. This applies to every source, including on Refresh.
- **Unauthenticated budget tracker:** the unauthenticated limit belongs to the backend IP, not a
  user, so one **process-wide, in-memory** tracker keeps `X-RateLimit-Remaining` /
  `X-RateLimit-Reset` of unauthenticated responses. Within one reset window it keeps the
  **minimum** `Remaining` seen; it replaces the window only when a response carries a later
  `Reset`, so out-of-order responses (parallel sources, Add) never raise the budget. Every
  unauthenticated call (sync or Add re-check) consults it first: remaining ≤ the caller's
  threshold and reset not passed ⇒ the sync marks the source `rate_limited` with that reset, and
  Add answers `503 GITHUB_RATE_LIMITED` ([routes](../../../backend/routes/repositories.md#add)), with no call.
  - **Two thresholds:** the sync stops at remaining **≤ 10**; Add only at **≤ 0**. The 10 is a
    real reserve for Add re-checks, which are bounded per user and by Add's 3-call
    [candidate walk](../../integrations/github-service/add-and-deletion.md#add-re-check-candidates).
  - **In-flight reservations:** each granted call decrements the tracked remaining by 1 before it
    is sent, so parallel sources and concurrent Adds never overshoot; GitHub's headers then
    correct it.
  - It is an optimisation: GitHub's headers stay the truth, and with several instances each
    learns the budget on its first call.
  - Its home is internal to the Integrations module's GitHub client
    ([GitHub service](../../integrations/github-service/add-and-deletion.md#unauthenticated-budget-tracker)).
- The unauthenticated source stops early when the remaining budget reaches the sync threshold,
  is marked **rate limited** with its reset time, and keeps its stored rows.
- **No per-user share of the unauthenticated budget:** one user with no usable integration can
  spend it down to the sync threshold, leaving other users' unauthenticated sources
  `rate_limited` until the reset (their Adds keep the reserve). Accepted for now, bounded by the
  cooldown and the thresholds ([security](../security.md#user-scoping)).

## Conditional requests

- **Page table** ([data model](../data-model.md#repositories_source_pages)): one row per (user, source,
  page) with `etag`, `has_next`, `fetched_at`. Never shared between users.
- Each page's stored `etag` is sent back as `If-None-Match`, **except on the last stored page**
  (the one whose stored `has_next` is `false`), which is always requested **without
  `If-None-Match`** so its fresh `Link` header decides whether to go on.
  - **Why:** when the last page N is full (100 repos), a newly created repo goes to page N+1 and
    leaves page N's body unchanged. A `304` on page N would let the stored `has_next = false` stop
    the source, and the new repo would never be fetched.
  - **Cost:** one full request per source per sync; authenticated, 1 of GitHub's 5000/h;
    unauthenticated, a `304` already costs the same as a `200`. Deletions and renames change page
    bodies, so they already answer `200`.
- **`200`:** the [write path](write-path.md#write-path) applies the page and stores the new `etag` /
  `has_next` in the same transaction.
- **`304`:** the page's source rows are kept and their repos' `last_seen_at` is set;
  `owner` / `name` / `private` are untouched (identical content). The stored `has_next` decides
  whether to continue.
- **Invalidation:** a failed or interrupted source keeps its page rows and ETags; deleting an
  integration drops its page and status rows; changing or clearing the handle drops the handle's
  page and status rows through the [handle reconciliation](../../auth/github-handle.md#handle-changes) (a new handle
  reads `pending`); a replaced credential needs nothing (GitHub's ETag
  differs, the next request gets `200`).
- **Rate limit:** a `304` is free of GitHub's rate limit **only on authenticated requests**. An
  unauthenticated `304` still counts against the shared 60/h; ETags there save transfer and
  writes, not budget.

## Network

- The base URL is fixed: `https://api.github.com` ([security](../security.md#fixed-github-base-url)).
- Every GitHub call has a timeout, and one sync bounds how many sources run in parallel
  ([values](#values)).
- Pagination builds its own page URLs and **never requests a URL taken from a response**;
  **no redirect is followed**, same-origin or not: any `3xx` makes the source `error` (Add:
  `502`), and `Authorization` never leaves `https://api.github.com`
  ([security](../security.md#fixed-github-base-url)).

## Values

| Value | Default | Configurable |
|---|---|---|
| Staleness TTL | 1 h | `KERGHAN_REPOSITORIES_SYNC_TTL_MS` (`3600000`) |
| Refresh cooldown (from the start of any sync) | 5 min | `KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS` (`300000`) |
| Page cap per source | 10 pages of `per_page=100` (1000 repos) | `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP` (`10`) |
| Unauthenticated rate-limit threshold | sync: stop when `X-RateLimit-Remaining` ≤ 10 (a reserve for Add re-checks; the 60/h is shared by every user on the backend IP); Add: refused only at ≤ 0 | constants |
| GitHub call timeout | 10 s per request | constant |
| Parallelism | up to 3 sources at once; pages within a source are sequential | constant |
| Lease (no heartbeat ⇒ dead) | 2 min | constant |
| Hard deadline per sync | 5 min | constant |
| Sync-state polling interval | 2 s | frontend constant ([frontend](../frontend.md#sync-ux)) |

- The env vars are read with `getNumberConfig` and these defaults; a value that is not a
  positive integer falls back to the default; they are listed in
  [Environment variables](../../../environment-variables.md).
- Every duration above is measured against the injected `Clock`, never `NOW()` in SQL
  ([time source](execution.md#time-source)); the per-request GitHub timeout is a timer in the Integrations
  client.

## Edge cases

Every sync edge case (renames and transfers, several sources, failure vs disappearance, the
integration lifecycle, the handle, visibility flips, the page cap, rate limits, `304`,
concurrency) is listed, with its outcome and its rule, in the
[edge-case matrix](../edge-cases.md).

