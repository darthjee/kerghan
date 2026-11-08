# Issue: Specs: repositories — sync engine

## Description

Part of Epic #444 (repositories listing). Spec-enhancement sub-issue, after #445 (feature
definition) and #446 (API contract), both merged. It settles the **sync engine** in
`docs/agents/specs/repos/`: how the asynchronous sync runs and recovers, its concrete values,
ETag storage, the write path, pruning, the handle's credential, and the exact schema.

## Problem

The specs leave the sync engine open: `sync.md#execution` (in-process vs queue, restart
behaviour, per-user lock), `sync.md#values` (TTL, cooldown, page cap, thresholds, timeouts,
parallelism), `model.md#tables` (table names, types, indexes, sync-state and ETag storage),
`model.md#private-metadata-lifecycle` (pruning rule) and `ui.md#sync-ux` (polling interval). The
API contract (#446) depends on a guarantee no spec gives yet: a sync stuck in `syncing` must
return to `idle`. `sync.md` also wrongly says a `304` never counts against GitHub's rate limit.

## Expected Behavior

- `sync.md`, `model.md`, `ui.md`, `api.md`, `security.md`, `integrations.md` and `README.md`
  (under `docs/agents/specs/repos/`) are updated as listed in [Scope](#scope), each new rule
  with "Required tests" in the file that defines it.
- Every `Open — settled by #447` marker and its README row are removed.
- No code changes, no permanent docs (#452 folds them; the three new env vars join its
  checklist).
- Required tests added at least for: the atomic claim (two concurrent triggers start one sync;
  cooldown and lease conditions); a stuck sync past its lease reads `idle` and can be taken
  over; a zombie run's writes are rejected by `run_id`; the hard deadline; per-page
  transactions and partial failure keeping applied pages; `304` reuse via the page table;
  page-number pagination never requesting a response-supplied URL; pruning of orphaned
  not-added repos only, blocked by failed sources; the Add/pruning race answering `404`; the
  handle's credential choice and next-integration-after-`401`; rate-limited sources skipped
  until `resetAt`; the unauthenticated budget tracker shared by sync and Add.

## Solution

### Execution model (settles `sync.md#execution`)

- **In-process.** The triggering request claims the per-user lock, starts the sync as a
  **detached promise** inside the Repositories service (not awaited), and answers immediately.
  A catch-all on the promise always releases the lock, even on an unexpected exception.
- **No queue.** BullMQ/Redis would add infrastructure to dev, production and the standalone image
  for an on-demand, low-frequency job; rejected.
- **Per-user lock: a conditional `UPDATE`** on the user's sync-state row (same pattern as
  `IntegrationTestCooldownService`):

  ```sql
  UPDATE <sync_states>
  SET state = 'syncing', last_started_at = :now, heartbeat_at = :now, run_id = :newUuid
  WHERE user_id = :userId
    AND (state = 'idle' OR heartbeat_at < :now - lease)
    AND (last_started_at IS NULL OR last_started_at < :now - cooldown)
  ```

  One row affected = this request owns the sync; zero = a sync is running (`202` with the current
  state) or the cooldown is active (`429` for Refresh, no sync for a stale listing). The row is
  created on first use with an insert that ignores duplicates, so concurrent triggers (two tabs)
  never start two syncs.
- A **stale listing** adds `AND (last_synced_at IS NULL OR last_synced_at < :now - ttl)` to
  the same claim; a Refresh does not. Both are bound by the cooldown clause.
- **Restart recovery: lease + heartbeat.**
  - The running sync bumps `heartbeat_at` after every GitHub page.
  - A row in `syncing` whose `heartbeat_at` is older than the **lease** is dead: the sync-state
    route reports it as `idle` (so polling ends), and the next trigger may take it over.
  - Every write of the run's final state is conditional on `run_id`, so a zombie run never
    overwrites a newer one.
  - A **hard deadline** bounds one sync; past it, the sync stops and keeps what it already
    applied.
  - No reset of `syncing` rows at boot: unsafe with two instances (rolling deploy); the lease
    works whatever the topology.
- **A source interrupted mid-sync** (restart, deadline) keeps its previous rows and status; the
  next sync redoes it in full.

### Values (settles `sync.md#values` and `ui.md#sync-ux`)

| Value | Default | Configurable |
|---|---|---|
| Staleness TTL | 1 h | `KERGHAN_REPOSITORIES_SYNC_TTL_MS` (3600000) |
| Refresh cooldown (from the start of any sync) | 5 min | `KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS` (300000) |
| Page cap per source | 10 pages of `per_page=100` (1000 repos) | `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP` (10) |
| Unauthenticated rate-limit threshold | stop when `X-RateLimit-Remaining` ≤ 10 (reserve for Add re-checks; the 60/h is shared by every user on the backend IP) | constant |
| GitHub call timeout | 10 s per request | constant |
| Parallelism | up to 3 sources at once; pages within a source are sequential (each next page comes from `Link`) | constant |
| Lease (no heartbeat ⇒ dead) | 2 min | constant |
| Hard deadline per sync | 5 min | constant |
| Sync-state polling interval | 2 s | frontend constant |

- The env vars are read with `getNumberConfig` and these defaults; #452 folds them into
  `environment-variables.md`.

### Pagination and ETags (refines `sync.md#conditional-requests`)

- **Page-number pagination.** The sync builds each page request itself
  (`?per_page=100&page=N`, on the endpoint #448 picks) and reads the `Link` header only to know
  whether `rel="next"` exists. It never requests a URL taken from a response. This replaces "follow
  every `Link`" in `sync.md` (the origin rules in `security.md` stay, now trivially met).
- **Page table** (working name `repositories_source_pages`): one row per (user, source, page)
  with `etag`, `has_next`, `fetched_at`. `source` is an integration id or the handle marker.
  Never shared between users.
- **Source rows gain a `page` column**, so the sources table itself records what each page
  contained (no JSON copy of ids).
- **`200`:** upsert the repos, rewrite that page's source rows (a repo moved from another page is
  upserted onto this one), then store the new `etag`/`has_next` — all in one transaction.
- **`304`** (sent `If-None-Match`): the page's source rows are kept, their repos' `last_seen_at`
  is set; `owner`/`name`/`private` are untouched (identical content). The stored `has_next`
  decides whether to continue.
- **End of a successful source:** source rows and page rows past its last page are deleted.
- **Invalidation:** a failed or interrupted source keeps its page rows and ETags; deleting an
  integration drops its page rows; changing the handle drops the handle's page rows; a replaced
  credential needs nothing (GitHub's ETag differs, the next request gets `200`).
- **Correction:** a `304` is free of GitHub's rate limit **only on authenticated requests**. An
  unauthenticated `304` still counts against the shared 60/h; ETags there save transfer and
  writes, not budget. `sync.md` is reworded accordingly.

### Write path (refines `sync.md#per-source`)

- **One transaction per page:**
  1. `UPDATE <sync_states> SET heartbeat_at = :now WHERE user_id = :userId AND run_id = :mine`;
     zero rows ⇒ the run lost its lease: roll back and stop (zombie guard on every write).
  2. Upsert the page's repos with `INSERT … ON DUPLICATE KEY UPDATE owner, name, private,
     updated_at` on (`user_id`, `github_id`). It never touches `added_at` or `integration_id`;
     concurrent-safe; when two sources return the same repo, the last write wins (same data).
     The handle source drops private repos before this step.
  3. Rewrite that page's source rows; set `last_seen_at` on its repos.
  4. Store the page's `etag` / `has_next`.
- The hard deadline is checked between pages.
- **End of a source** (one transaction, `run_id`-guarded):
  - success: delete source rows and page rows past its last page; store `ok` and `syncedAt`;
  - failure (`401`, timeout, `5xx`, rate limit, deadline): store only the status. **Pages
    already applied stay applied**, the rest keep their old rows: partly refreshed, never lost.
    Its added repos read Unknown, and nothing of it is pruned;
  - page cap: `page_cap_reached`; nothing past the cap is deleted.
- **End of the sync** (`run_id`-guarded): `state = idle`, `run_id = null`,
  `last_synced_at = :now` — **even when every source failed** (the sync finished; per-source
  statuses carry the failures). A run that lost its lease or crashed never sets
  `last_synced_at`, so the next listing starts a sync once the cooldown has passed.
- **`last_seen_at` is redefined** as "when a source page last returned the repo" (`200` or
  `304`), even if that source fails on a later page. It is informational: no status derives from
  it (statuses come from source rows and per-source statuses).
- Rejected: all-or-nothing per source (buffer every page, write once) — long transactions and
  lost work on failure.

### Pruning (settles `model.md#private-metadata-lifecycle`)

- **Rule:** a not-added repo (`added_at IS NULL`) is deleted when **no source row** points at it.
  Nothing else is checked: a successful source has already dropped the rows it no longer returns
  (page rewrites, cleanup past its last page), and a failed, interrupted or capped source keeps
  its rows — so a failure blocks pruning by construction.
- **When:** one statement at the end of the sync, in the final `run_id`-guarded transaction:

  ```sql
  DELETE r FROM repositories r
  WHERE r.user_id = :userId AND r.added_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM repositories_sources s WHERE s.repository_id = r.id)
  ```

  The same pruning runs right after changes that orphan rows outside a sync: an integration's
  source rows dropped by the deletion hook (#448 picks the mechanism), the handle changed or
  cleared (its source and page rows dropped; #449 owns the handle edit).
- Added repos are never deleted; they read Unavailable.
- **Race with Add:** pruning deletes only `added_at IS NULL` rows, and Add's write is
  `UPDATE … WHERE id = :id AND user_id = :userId`. Add commits first ⇒ the row is skipped;
  pruning first ⇒ Add's update affects no row and Add answers `404 NOT_FOUND` (the repo left the
  listing). The rest of the edge-case matrix stays with #450.
- Rejected: a grace period before pruning — private metadata would outlive access, against
  #444's lifecycle rule; failed sources are already protected by keeping their rows.

### Handle credential and rate-limit skip (refines `sync.md#sources`, `sync.md#rate-limits`)

- **The handle's public repos go through the oldest usable integration** (`created_at`, then
  `id`) — the same choice as Add's access link; which statuses are usable stays #448's.
- **On `401`** that integration is set `invalid` and the handle source **restarts from page 1
  with the next usable integration**, then the unauthenticated path (under its threshold) when
  none is left.
- **On a rate limit, timeout or `5xx`: no fallback** — the source is `rate_limited` / `error`.
  Falling back to the unauthenticated path would spend the budget every user shares.
- The source status never reveals which credential served it (already in `api.md`).
- **`rate_limited` sources are skipped** while their stored `resetAt` is in the future: no call;
  status, `resetAt` and rows are kept. Applies to every source.
- **Unauthenticated budget tracker:** the unauthenticated limit belongs to the backend IP, not a
  user, so one **process-wide, in-memory** tracker keeps the latest `X-RateLimit-Remaining` /
  `X-RateLimit-Reset` of unauthenticated responses. Every unauthenticated call (sync or Add
  re-check) consults it first: remaining ≤ threshold (10) and reset not passed ⇒ the sync marks
  the source `rate_limited` with that reset, and Add answers `503 GITHUB_RATE_LIMITED`
  (`api.md#add`), with no call. It is an optimisation: GitHub's headers stay the truth, and with
  several instances each learns the budget on its first call. Its home in code is #448's (the
  GitHub client).

### Schema (settles `model.md#tables`)

Conventions follow `integrations`: `int` auto-increment `id`, plain `int` `user_id` (no relation,
logical FK), explicit `varchar` lengths, `datetime`, index names `idx_<table>_<cols>` /
`uq_<table>_<cols>`. MySQL's default `utf8mb4_0900_ai_ci` collation gives the case-insensitive
`fullName` lookup.

**Source key:** `source_key varchar(32)`, `integration:<id>` or `handle` — not a nullable
`integration_id` (MySQL unique indexes allow several `NULL`s) nor a `0` sentinel.

| Table | Columns | Indexes |
|---|---|---|
| `repositories` | `id`; `user_id int`; `github_id bigint` (mapped to a JS number: GitHub ids will pass 2³¹, stay far below 2⁵³); `owner varchar(39)`; `name varchar(100)` (GitHub's limits); `private boolean`; `added_at datetime NULL`; `integration_id int NULL`; `last_seen_at datetime`; `created_at`, `updated_at` | unique (`user_id`, `github_id`); (`user_id`, `added_at`); (`user_id`, `owner`, `name`); (`integration_id`) |
| `repositories_sources` | `id`; `user_id int` (denormalised for per-user/per-source cleanup without a join); `repository_id int`; `source_key`; `page smallint` | unique (`repository_id`, `source_key`); (`user_id`, `source_key`, `page`) |
| `repositories_source_pages` | `id`; `user_id int`; `source_key`; `page smallint`; `etag varchar(255)`; `has_next boolean`; `fetched_at datetime` | unique (`user_id`, `source_key`, `page`) |
| `repositories_sync_states` | `user_id int`; `state varchar(16)` (`idle`/`syncing`); `run_id char(36) NULL`; `last_started_at datetime NULL` (cooldown anchor, never cleared); `heartbeat_at datetime NULL`; `last_synced_at datetime NULL`; `created_at`, `updated_at` | unique (`user_id`) |
| `repositories_source_statuses` | `id`; `user_id int`; `source_key`; `status varchar(32)`; `synced_at datetime`; `reset_at datetime NULL` | unique (`user_id`, `source_key`) |

- Search (`LIKE '%…%'`) scans, bounded to one user's rows.
- The API's `startedAt` is `last_started_at` while `syncing`, `null` when idle; the cooldown and
  `refreshAvailableAt` derive from `last_started_at`.
- A current source with no `repositories_source_statuses` row reads `pending`.
- Per-source statuses are a table, not JSON on the sync state: each source writes its status in
  its own transaction, and the deletion hook drops one row.

### Scope

Spec files only; no code, no permanent docs.

| File | Change |
|---|---|
| `sync.md` | Remove the Execution and Values markers; lock/lease/deadline, page-number pagination and ETags, write path, pruning, handle credential, rate-limit skip and unauthenticated tracker, the `304` correction, required tests. |
| `model.md` | Remove the Tables and pruning markers; the five tables, `source_key`, the `last_seen_at` redefinition, the pruning rule. |
| `ui.md` | Remove the polling marker; interval 2 s. |
| `api.md` | `startedAt` from `last_started_at`; "skip `rate_limited` until `resetAt`" settled; a stuck sync past its lease reads `idle`; Add losing a race with pruning answers `404`. |
| `security.md` | Fixed base URL: pagination builds page URLs instead of following `Link`; test. |
| `integrations.md` | Notes for #448: the unauthenticated budget tracker lives in the GitHub client; the handle source's next-integration-after-`401`. |
| `README.md` | Drop the #447 marker rows, update the decisions summary, add the three env vars to the #452 checklist. |

Out of scope: GitHub endpoints and per-type auth, the tracker's code location (#448); the handle
column and validation (#449); the full edge-case matrix (#450); mocking tools and test layout
(#451).

**Backward compatibility:** new tables for a feature not built yet; no existing data or behaviour
changes. The only correction to published spec text is the `304` rule in `sync.md`.

## Benefits

- Implementation sub-issues get a complete, testable sync design with no new infrastructure
  (no queue, no Redis).
- Polling always ends, even after a restart mid-sync.
- The shared unauthenticated budget and per-credential limits are protected.
- Private metadata never outlives a successful source that stopped returning it.
