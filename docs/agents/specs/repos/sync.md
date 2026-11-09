# Repositories — Sync

How the backend syncs GitHub into the [data model](model.md). Part of the
[Repositories specs](README.md).

## Sources

A user's sync reads every source they have:

- **Each of their integrations** (`pat`, `oauth_app`, `github_app`), whatever its status: the
  repositories that credential can see, including private and organization ones. Requests go
  through the Integrations module ([integrations.md](integrations.md#exported-service)), on the
  endpoint of its type ([endpoints](integrations.md#endpoints-and-parameters)).
  - A **non-usable** integration ([usable integrations](integrations.md#usable-integrations)) is
    not called: its source records `invalid_credentials` (status `expired`, `invalid` or
    `undecryptable`) or `error` (type disabled on this server), and keeps its earlier rows and
    pages, like any [failed source](#partial-failures).
  - A **missing** integration (deleted since the run listed the user's integrations) answers
    `integration_unusable` with reason `missing`
    ([usable integrations](integrations.md#usable-integrations)). The run stops that source and
    writes nothing more for it, **no status** either, as for a handle changed mid-sync
    ([write path](#write-path)); the deletion hook and the end-of-sync safety net drop its rows.
    The reason never reaches a response.
- **The GitHub handle** ([model.md](model.md#github-handle)): the handle's public repositories.
  - The run reads the current handle through Auth's export when it starts, after the
    [handle reconciliation](model.md#handle-changes); no handle ⇒ no handle source. The handle
    it started with is the run's **handle** for the [write guard](#write-path).
  - They are fetched **through the oldest usable integration**, with that credential's own rate
    limit ([handle credential](#handle-credential)).
  - The **unauthenticated** path, which shares the backend IP's 60 requests/hour, is used only
    when no usable integration is left.
  - The handle source keeps only repos with `private = false`, even when fetched through an
    integration, so private metadata is always tied to the integration that granted it.

Results are merged by GitHub repository id; each repo records which sources returned it
([model.md](model.md#repositories_sources)).

### Handle credential

- The handle's public repositories go through the user's **oldest usable integration**
  (`created_at`, then `id`), the same choice as Add's access link
  ([integrations.md](integrations.md#access-link-on-add)). **Usable** means reported status
  `active` and type enabled on this server; `expired`, `invalid` and `undecryptable` integrations
  are never handle credentials ([usable integrations](integrations.md#usable-integrations)). The
  sync takes them from `listUsableIntegrations`.
- On an **`invalid_credentials`** result (a `401`, which sets the integration `invalid`), the
  handle source **restarts from page 1 with the next usable integration**; with none left, it
  uses the unauthenticated path, under its [threshold](#rate-limits). A `github_app` call's `401`
  that survives the token re-mint is `unavailable`, not `invalid_credentials`, so it does not
  fall back ([installation tokens](integrations.md#github-app-installation-tokens)).
- On a **rate limit, timeout or `5xx`, there is no fallback**: the source is `rate_limited` /
  `error`. Falling back to the unauthenticated path would spend the budget every user shares.
- A **`404`** on the handle listing (an unknown, renamed, suspended or deleted handle) makes the
  source **`not_found`**, whatever credential served it ([error mapping](integrations.md#error-mapping)).
  - **No fallback:** a `404` is not a `401`, so no other credential is tried.
  - **Not ok for row statuses:** its rows and pages are kept, so nothing is pruned, and added repos
    it alone holds read Unknown ([model.md](model.md#row-statuses)). A renamed handle's repos
    still exist on GitHub under the new name.
  - **Retried on every sync:** it is not skipped like `rate_limited`.
- The source status never reveals which credential served it ([api.md](api.md#sync-state)).
- **Endpoints** ([integrations.md](integrations.md#endpoints-and-parameters)): `pat` and
  `oauth_app` sources read `GET /user/repos` (`affiliation=owner,collaborator,organization_member`,
  `visibility=all`, `sort=created&direction=asc`); `github_app` sources read
  `GET /installation/repositories` with an installation token; the handle reads
  `GET /users/{handle}/repos?type=owner&sort=created&direction=asc`, whatever the credential.

## Trigger

- **Stale:** the listing (`POST /repositories/mine.json`) starts a sync when the user's last
  sync is older than a TTL ([api.md](api.md#stale-sync-trigger)).
- **Refresh:** the Refresh action forces a sync, subject to a **cooldown**; a Refresh inside it
  is refused (`429` with `Retry-After`, see [api.md](api.md#refresh)).
- **The cooldown runs from the start of the last sync, whatever triggered it** (stale listing or
  Refresh), and binds both: a stale listing inside the cooldown starts no sync
  ([api.md](api.md#stale-sync-trigger)), whatever the TTL.
- **One sync per user at a time:** a trigger while a sync runs does not start a second one; a
  Refresh while syncing answers `202` with the running sync and does not reset the cooldown.
- Both triggers go through the same [atomic claim](#per-user-lock); the cooldown is anchored on
  `last_started_at`, set by every claim, whatever triggered it. A stale listing adds the TTL
  condition to the claim; a Refresh does not.
- No scheduled job, no background polling of GitHub.

## Execution

The sync is **asynchronous**: the request that triggers it does not wait for GitHub.

- The listing returns the stored rows immediately, with the sync state (`idle` / `syncing`,
  `lastSyncedAt`, per-source status; [api.md](api.md#sync-state)).
- The frontend polls `POST /repositories/sync/state.json` until it is `idle`, then reloads the
  page of rows ([api.md](api.md#polling-contract), [ui.md](ui.md#sync-ux)). That route never
  starts a sync.

- **In-process.** The triggering request claims the [per-user lock](#per-user-lock), starts the
  sync as a **detached promise** inside the Repositories service (not awaited), and answers
  immediately. A catch-all on the promise always releases the lock, even on an unexpected
  exception. That release is `run_id`-guarded like every other write
  (`UPDATE … SET state = 'idle', run_id = NULL WHERE user_id = :userId AND run_id = :mine`) and
  never sets `last_synced_at`, so a zombie's exception never releases a newer run's lock.
- **Injected `SyncLauncher`.** The detached promise is started only through an injected
  `SyncLauncher`, whose `launch(task)` detaches the run and catches its errors. It is the only way
  a sync is started (stale listing and Refresh alike), so production behaviour is the detached
  promise above, and tests swap in a launcher that captures the task
  ([testing.md](testing.md#detached-sync-and-time)).
- **No queue.** A job queue (BullMQ/Redis) would add infrastructure to dev, production and the
  standalone image for an on-demand, low-frequency job; rejected.
- **A sync stuck in `syncing` always returns to `idle`** ([restart recovery](#restart-recovery)),
  so polling always ends ([api.md](api.md#polling-contract)).

### Per-user lock

A **conditional `UPDATE`** on the user's sync-state row ([model.md](model.md#repositories_sync_states)),
the same pattern as `IntegrationTestCooldownService`:

```sql
UPDATE repositories_sync_states
SET state = 'syncing', last_started_at = :now, heartbeat_at = :now, run_id = :newUuid
WHERE user_id = :userId
  AND (state = 'idle' OR heartbeat_at < :now - lease)
  AND (last_started_at IS NULL OR last_started_at < :now - cooldown)
```

- **One row affected:** this request owns the sync.
- **Zero rows:** the row is re-read (not atomic, as in
  `IntegrationTestCooldownService#remainingSeconds`): `syncing` with a live heartbeat ⇒ a sync is
  running (Refresh answers `202` with that state); otherwise (`idle`, or a dead lease still inside
  the cooldown) ⇒ the cooldown is active (Refresh answers `429` with `Retry-After` from
  `last_started_at`; a stale listing starts no sync) ([api.md](api.md#refresh)). If the re-read
  finds the row idle and out of the cooldown (the run ended in between), the claim is retried
  once.
- A **stale listing** adds `AND (last_synced_at IS NULL OR last_synced_at < :now - ttl)` to the
  same claim; a Refresh does not. Both are bound by the cooldown clause.
- The row is created on first use, before the claim, with
  `INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` (a no-op on duplicate; not `INSERT IGNORE`,
  which would also hide other errors), so concurrent triggers (two tabs) never start two syncs.

### Time source

- **Injected `Clock`** (`now(): Date`): the only time source of the Repositories module, never
  `Date.now()` / `new Date()` directly. Every time rule reads it: the TTL, the Refresh cooldown,
  the lease and its heartbeat, the hard deadline, `resetAt` checks of `rate_limited` sources, and
  the Add rate-limit window ([api.md](api.md#add-rate-limit)). Every timestamp the module writes
  (`last_started_at`, `heartbeat_at`, `last_synced_at`, `last_seen_at`, `synced_at`, `added_at`)
  comes from it.
- **No `NOW()` / `CURRENT_TIMESTAMP` in SQL time conditions.** Every time condition (lease
  expiry, TTL, cooldown, heartbeat) compares against an app-supplied timestamp parameter from the
  `Clock` (the `:now` of the claim above), so the application and the database never disagree
  about time, and tests drive both with one fake clock
  ([testing.md](testing.md#detached-sync-and-time)).

### Restart recovery

- **Heartbeat:** the running sync bumps `heartbeat_at` after every GitHub page
  ([write path](#write-path)).
- **Lease:** a row in `syncing` whose `heartbeat_at` is older than the lease is **dead**. The
  sync-state route reports it as `idle` (so polling ends), and the next trigger may take it over
  through the claim above.
- **`run_id` guard:** every write of the run (each page, each source's end, the sync's end, the
  catch-all release) is conditional on `run_id`, so a zombie run never overwrites a newer one.
- **Hard deadline:** one sync is bounded; it is checked between pages. Past it, the sync stops
  and keeps what it already applied; each source it cut short stores `error`.
- **No reset of `syncing` rows at boot:** unsafe with two instances (rolling deploy); the lease
  works whatever the topology.
- **A source interrupted mid-sync** keeps the pages it already applied and the old rows of the
  rest. After a restart its previous status stays (nothing is written); when stopped by the
  deadline it stores `error`. The next sync redoes it in full.

## Per source

For each source, the sync reads GitHub page by page, up to the **page cap**:

- **Page-number pagination.** The sync builds every page request itself (`?per_page=100&page=N`,
  on the [endpoint of the source](integrations.md#endpoints-and-parameters)) and reads the `Link` header **only to know whether `rel="next"`
  exists**. It never requests a URL taken from a response
  ([security.md](security.md#fixed-github-base-url)).
- Pages within a source are sequential; up to the parallelism bound of sources run at once
  ([values](#values)).
- The handle source drops private repos before writing anything.
- At the end, the source's status is stored: `ok`, `error`, `invalid_credentials`,
  `rate_limited` (with the reset time), `page_cap_reached` or `not_found` (handle only)
  ([model.md](model.md#repositories_source_statuses)). A source added since the last sync reads
  as `pending` until it runs ([api.md](api.md#sync-state)).

### Write path

**One transaction per page.** The GitHub request is made **before** the transaction opens; the
transaction holds only the database writes. Step 1 locks the user's sync-state row, so the page
transactions of one user's parallel sources run one after another, which keeps the upserts free
of deadlocks.

1. `UPDATE repositories_sync_states SET heartbeat_at = :now WHERE user_id = :userId AND run_id = :mine`;
   zero rows ⇒ the run lost its lease: roll back and stop (zombie guard on every write).
   **Handle source only:** the same statement adds `AND handle <=> :runHandle` (the handle the run
   started with). Zero rows while a re-read shows `run_id` still the run's ⇒ the handle changed
   since the run started ([model.md](model.md#handle-changes)): roll back and stop the handle
   source only, writing nothing more for it (no status: the reconciliation already dropped its
   rows, so the new handle reads `pending`); the other sources go on. Its end-of-source
   transaction carries the same guard.
2. Upsert the page's repos with `INSERT … ON DUPLICATE KEY UPDATE owner, name, private,
   last_seen_at, updated_at` on (`user_id`, `github_id`), then
   `SELECT id, github_id … WHERE user_id = :userId AND github_id IN (:pageIds)` to map the page
   to row ids (a multi-row upsert does not return updated rows' ids). It never touches
   `added_at` or `integration_id`, is safe under concurrency, and when two sources return the same repo the last write wins (same
   data). When the upsert turns a repo **private**, its `handle` source row (if any) is deleted
   in the same transaction, so a stale handle row from a failed or skipped handle source never
   keeps private metadata alive ([pruning](#pruning)).
3. Rewrite that page's source rows (a repo moved from another page is upserted onto this one).
4. Store the page's `etag` / `has_next` ([conditional requests](#conditional-requests)).

The hard deadline is checked between pages.

**End of a source** (one transaction, `run_id`-guarded; every delete `AND user_id = :userId`,
since `source_key = 'handle'` is the same string for every user):

- **success:** delete its source rows and page rows past its last page; store `ok` and
  `syncedAt`;
- **failure** (`401`, timeout, `5xx`, a redirect, rate limit, deadline): store only the status
  (`invalid_credentials`, `rate_limited`, or `error` for the others; see
  [partial failures](#partial-failures));
- **page cap:** delete its source rows and page rows **past the cap**, as for a success whose
  last page is the cap; store `page_cap_reached` (it counts as `ok` for row statuses,
  [model.md](model.md#row-statuses)). Pruning then applies.
  - **Accepted outcome:** after the cap is lowered, added repos past the new cap read Unavailable
    although GitHub still returns them, because Kerghan stopped reading that far; the
    `page_cap_reached` banner ("some may be missing") explains it, and the added rows are kept.
  - **Why:** listings sort by `created` ascending, so new repos land past the end and deletions
    only pull repos toward earlier pages. Rows past the cap exist only after the cap was
    **lowered**; the source never fetches them again, so keeping them would let private metadata
    outlive any check.

**End of the sync** (one transaction, `run_id`-guarded): drop the source, page and status rows
(each statement `AND user_id = :userId`) of any `integration:<id>` key whose id is not among
**all** the user's integrations (loaded `WHERE user_id = :userId`, usable or not, so a non-usable
integration's rows are kept) (the **safety net** for a
failed [deletion hook](integrations.md#deletion-hook), or a page a parallel run wrote after the
hook's cleanup), then the [link fill](#link-fill), then [prune](#pruning), then `state = idle`,
`run_id = null`, `last_synced_at = :now`, **even when every source failed** (the sync finished;
per-source statuses carry the failures). A run that lost its lease or crashed never sets
`last_synced_at`, so the next listing starts a sync once the cooldown has passed.

- **`last_seen_at`** is "when a source page last returned the repo" (`200` or `304`), even if
  that source fails on a later page. It is informational: no status derives from it
  ([model.md](model.md#repositories)).
- Rejected: all-or-nothing per source (buffer every page, write once): long transactions and
  lost work on failure.
- **A run never creates the sync-state row.** Only the request entry points (the listing, the
  sync-state route, Refresh, Add) create it, with `INSERT … ON DUPLICATE KEY UPDATE`. The run's
  start-of-run [handle reconciliation](model.md#handle-changes) only locks and updates an existing
  row; with no row, the run stops. A deleted user's row ([user deletion](model.md#user-deletion))
  makes every guarded write of a running sync affect no row, so the run rolls back, stops, and
  recreates nothing.

### Link fill

In the end-of-sync transaction, after the safety net and before pruning, an empty or dangling
access link of an added private repo is filled:

```sql
UPDATE repositories
SET integration_id = :integrationId
WHERE user_id = :userId AND id = :repositoryId
  AND added_at IS NOT NULL AND private = true
  AND (integration_id IS NULL OR integration_id NOT IN (:userIntegrationIds))
```

- **Skipped with no usable integration:** the fill runs only when the user has at least one
  usable integration, so `:userIntegrationIds` (all the user's integrations, loaded
  `WHERE user_id = :userId`) is never empty.
- **Which repos:** added (`added_at` set), private, with an `integration_id` that is empty or not
  among the user's integrations.
- **Which integration:** the **oldest usable** integration (`created_at`, then `id`) holding a
  source row for the repo from a source whose status is `ok` or `page_cap_reached` after this
  run. No such integration ⇒ the link stays empty and the repo reads Unavailable.
- **Never changes an existing link.** The `WHERE` clause matches only an empty or dangling link
  (a link to an existing integration, even a non-usable one, is kept), so it never overwrites a
  link Add wrote concurrently. A public repo and a not-added repo are never touched.
- **Amends #444:** #444 made a private repo whose linked integration was deleted Unavailable for
  good; the fill makes it Unavailable only until the next sync that finds a usable integration
  returning it. Changing an existing link stays out of scope ([README](README.md#scope)).
- Every statement is `run_id`-guarded (the transaction's first statement) and `AND user_id =
  :userId`; it uses the (`user_id`, `integration_id`) index.

## Partial failures

- A failing source (`401`, timeout, `5xx`, rate limit, deadline) **does not fail the sync**; the
  other sources are still applied.
- **Pages already applied stay applied**; the rest keep their old rows: partly refreshed, never
  lost. Added repos held only by failed sources' rows read as Unknown, not Unavailable
  ([model.md](model.md#row-statuses)), and nothing of it is pruned.
- A `401` on an integration sets it to `invalid`, through the Integrations module
  ([integrations.md](integrations.md#invalid-on-401)); the handle source then moves to the next
  credential ([handle credential](#handle-credential)).
- Hitting the page cap is reported as the source's status (`page_cap_reached`, which counts as
  `ok`); pages already read are applied and rows past the cap are deleted
  ([write path](#write-path)).

## Pruning

- **Rule:** a not-added repo (`added_at IS NULL`) is deleted when **no source row** points at it
  ([model.md](model.md#private-metadata-lifecycle)). Nothing else is checked: a successful source
  has already dropped the rows it no longer returns (a capped source drops those past the cap),
  and a failed or interrupted source keeps its rows, so **a failure blocks pruning by
  construction**.
- **When:** one statement in the end-of-sync transaction; and after changes that orphan
  rows outside a sync (an integration's source rows dropped by the deletion hook, the handle
  changed or cleared: the [handle reconciliation](model.md#handle-changes) prunes on the next
  Repositories request).
- Added repos are never deleted; they read Unavailable.

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
  Add answers `503 GITHUB_RATE_LIMITED` ([api.md](api.md#add)), with no call.
  - **Two thresholds:** the sync stops at remaining **≤ 10**; Add only at **≤ 0**. The 10 is a
    real reserve for Add re-checks, which are bounded per user and by Add's 3-call
    [candidate walk](integrations.md#add-re-check-candidates).
  - **In-flight reservations:** each granted call decrements the tracked remaining by 1 before it
    is sent, so parallel sources and concurrent Adds never overshoot; GitHub's headers then
    correct it.
  - It is an optimisation: GitHub's headers stay the truth, and with several instances each
    learns the budget on its first call.
  - Its home is internal to the Integrations module's GitHub client
    ([integrations.md](integrations.md#unauthenticated-budget-tracker)).
- The unauthenticated source stops early when the remaining budget reaches the sync threshold,
  is marked **rate limited** with its reset time, and keeps its stored rows.
- **No per-user share of the unauthenticated budget:** one user with no usable integration can
  spend it down to the sync threshold, leaving other users' unauthenticated sources
  `rate_limited` until the reset (their Adds keep the reserve). Accepted for now, bounded by the
  cooldown and the thresholds ([security.md](security.md#user-scoping)).

## Conditional requests

- **Page table** ([model.md](model.md#repositories_source_pages)): one row per (user, source,
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
- **`200`:** the [write path](#write-path) applies the page and stores the new `etag` /
  `has_next` in the same transaction.
- **`304`:** the page's source rows are kept and their repos' `last_seen_at` is set;
  `owner` / `name` / `private` are untouched (identical content). The stored `has_next` decides
  whether to continue.
- **Invalidation:** a failed or interrupted source keeps its page rows and ETags; deleting an
  integration drops its page and status rows; changing or clearing the handle drops the handle's
  page and status rows through the [handle reconciliation](model.md#handle-changes) (a new handle
  reads `pending`); a replaced credential needs nothing (GitHub's ETag
  differs, the next request gets `200`).
- **Rate limit:** a `304` is free of GitHub's rate limit **only on authenticated requests**. An
  unauthenticated `304` still counts against the shared 60/h; ETags there save transfer and
  writes, not budget.

## Network

- The base URL is fixed: `https://api.github.com` ([security.md](security.md#fixed-github-base-url)).
- Every GitHub call has a timeout, and one sync bounds how many sources run in parallel
  ([values](#values)).
- Pagination builds its own page URLs and **never requests a URL taken from a response**;
  **no redirect is followed**, same-origin or not: any `3xx` makes the source `error` (Add:
  `502`), and `Authorization` never leaves `https://api.github.com`
  ([security.md](security.md#fixed-github-base-url)).

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
| Sync-state polling interval | 2 s | frontend constant ([ui.md](ui.md#sync-ux)) |

- The env vars are read with `getNumberConfig` and these defaults; a value that is not a
  positive integer falls back to the default; #452 folds them into
  `environment-variables.md` ([README.md](README.md#product-changes-folded-by-452)).
- Every duration above is measured against the injected `Clock`, never `NOW()` in SQL
  ([time source](#time-source)); the per-request GitHub timeout is a timer in the Integrations
  client.

## Edge cases

Every sync edge case (renames and transfers, several sources, failure vs disappearance, the
integration lifecycle, the handle, visibility flips, the page cap, rate limits, `304`,
concurrency) is listed, with its outcome and its rule, in the
[edge-case matrix](edge-cases.md).

## Required tests

Tiers, fakes and harnesses: [testing.md](testing.md). Tags: `(db)`, `(e2e)`, `(unit)`,
`(static)`, `(race)` ([default tiers](testing.md#default-tier-by-category)).

**Trigger, execution and lock:**

- Opening the listing with a stale sync starts one; with a fresh sync, during a running sync, or
  inside the Refresh cooldown (including right after a stale-triggered sync), it does not. The
  HTTP answers are [api.md](api.md#required-tests)'s.
- The atomic claim: two concurrent triggers start exactly one sync and never duplicate rows; the
  claim fails inside the cooldown, and while another run holds an unexpired lease; a stale
  listing also needs the TTL condition, a Refresh does not.
- The sync-state row is created on first use without duplicates under concurrent triggers.
- A zero-row claim re-reads the row: a live heartbeat means a running sync, otherwise the
  cooldown; it retries the claim once when the run ended in between.
- The triggering request answers with the stored rows and the sync state **before** the captured
  task runs, and the fake logs no GitHub call; after `runAll()` the run's effects are visible
  `(e2e)`.
- Every sync is started through the injected `SyncLauncher`; an unexpected exception in the task
  still releases the lock, but a zombie's exception never releases a newer run's lock.
- A sync stuck in `syncing` past its lease can be taken over by the next trigger; the sync-state
  answer is [api.md](api.md#required-tests)'s.
- A zombie run's writes (page, end of source, end of sync) are rejected by `run_id`: run A paused
  at a GitHub call, the clock advanced past the lease, run B started `(race)`.
- The hard deadline stops the sync between pages; applied pages are kept; each source it cut
  short stores `error`; the run still ends `idle`.

**Time source:**

- Every time rule (TTL, cooldown, lease, heartbeat, hard deadline, `resetAt`, the Add rate-limit
  window) follows the `FakeClock`: a spec moves it with `set` / `advance` and never waits.
- No SQL time condition of the Repositories module uses `NOW()` / `CURRENT_TIMESTAMP` `(static)`.

**Sources:**

- The handle's repos go through the oldest usable integration; unauthenticated only when none is
  usable. After an `invalid_credentials` result it restarts from page 1 with the next usable
  integration, then unauthenticated; a rate limit, timeout or `5xx` does not fall back. (The
  `401 → invalid` write itself is [integrations.md](integrations.md#required-tests)'s.)
- The handle source never stores a private repo, even when fetched through an integration.
- A non-usable integration's source stores `invalid_credentials` (status) or `error` (type
  disabled) and keeps its rows and pages. (That it is never called is
  [integrations.md](integrations.md#required-tests)'s.)
- A source whose integration is deleted mid-sync (`integration_unusable` with reason `missing`)
  stops and writes no status `(race)`.
- A handle source answered `not_found` stores `not_found`, keeps the handle's rows and pages,
  prunes nothing, tries no other credential, and is retried on the next sync. (The `404 →
  not_found` mapping is [integrations.md](integrations.md#required-tests)'s; the row status is
  [model.md](model.md#required-tests)'s.)
- A sync run reconciles the handle when it starts and fetches the current, normalised handle;
  with no handle there is no handle source. (Its URL-encoding is
  [integrations.md](integrations.md#required-tests)'s.)
- A handle changed while a run is fetching it: the
  [edge-case scenario](edge-cases.md#required-tests).

**Write path:**

- Each page is applied in its own transaction; a source failing on a later page keeps the pages
  already applied and the old rows of the rest; its status is stored, nothing of it is pruned.
- A failing source does not fail the sync: the other sources are applied.
- The upsert never changes `added_at` or `integration_id`.
- When an integration sync turns a repo private, its `handle` source row is dropped; a not-added
  repo then held only by that integration is pruned once the integration is deleted, even if the
  handle source failed or was skipped.
- The end of a successful source deletes its source and page rows past its last page.
- Reaching the page cap stops the source, stores `page_cap_reached`, deletes its source and page
  rows past the cap, then prunes.
- `last_synced_at` is set at the end of a sync even when every source failed; a run that lost
  its lease never sets it.
- `last_seen_at` is set on a `200` and on a `304`.
- A run whose sync-state row was deleted stops at its next write and never recreates the row,
  including through its start-of-run handle reconciliation `(race)`.
- A redirect answer (`unavailable` with reason `redirect`) makes the source `error`. (That no
  redirect is followed is [integrations.md](integrations.md#required-tests)'s.)

**Link fill:**

- The end-of-sync fill links the oldest usable integration whose source is `ok` or
  `page_cap_reached` and holds a row for it to an added private repo with an empty or dangling
  link.
- It never touches an existing link, a public repo or a not-added repo; with no such
  integration the link stays empty.

**Conditional requests and pagination:**

- A `304` reuses the stored page through the page table: source rows kept, `owner` / `name` /
  `private` untouched, the stored `has_next` decides whether to continue.
- The last stored page (`has_next = false`) is requested without `If-None-Match`; earlier pages
  send their `etag`.
- With a full last page and a new repo created since, the next sync fetches the new page.
- Pagination asks for page `N + 1` only while `hasNext` is true, and up to the page cap.
- Page, status and source rows dropped by an integration deletion or a handle change: the
  cleanup tests of [model.md](model.md#required-tests).

**Pruning:**

- Pruning runs in the end-of-sync transaction; a failed or interrupted source blocks pruning of
  its repos by keeping its rows. (The pruning query itself is
  [model.md](model.md#required-tests)'s.)

**Rate limits:**

- A `rate_limited` source is skipped while its `resetAt` is in the future, Refresh included: no
  call, status, `resetAt` and rows kept.
- A refused budget acquire (a `rate_limited` result with no GitHub call) marks the
  unauthenticated source `rate_limited` with that reset and keeps its rows. (The tracker itself is
  [integrations.md](integrations.md#required-tests)'s.)

**Integration deletion:**

- The end-of-sync safety net drops the source, page and status rows of an integration deleted
  during the sync (a page answer released after the deletion hook's cleanup, or a failed
  listener), before pruning; every statement is scoped by `user_id`, and a still-existing
  non-usable integration's rows are kept `(race)`.

**Values:**

- The defaults apply, and the three env vars override the TTL, the cooldown and the page cap; a
  value that is not a positive integer falls back to the default `(unit)`.
