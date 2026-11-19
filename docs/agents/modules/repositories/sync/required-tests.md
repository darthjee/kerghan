# Repositories — Sync: Required Tests

Part of the [Repositories sync](../sync.md) doc, in the [Repositories module](../../repositories.md).

## Required tests

Tiers, fakes and harnesses: [Testing](../testing.md). Tags: `(db)`, `(e2e)`, `(unit)`,
`(static)`, `(race)` ([default tiers](../testing.md#default-tier-by-category)).

**Trigger, execution and lock:**

- Opening the listing with a stale sync starts one; with a fresh sync, during a running sync, or
  inside the Refresh cooldown (including right after a stale-triggered sync), it does not. The
  HTTP answers are [routes](../../../backend/routes/repositories.md#required-tests)'s.
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
  answer is [routes](../../../backend/routes/repositories.md#required-tests)'s.
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
  `401 → invalid` write itself is [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s.)
- The handle source never stores a private repo, even when fetched through an integration.
- A non-usable integration's source stores `invalid_credentials` (status) or `error` (type
  disabled) and keeps its rows and pages. (That it is never called is
  [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s.)
- A source whose integration is deleted mid-sync (`integration_unusable` with reason `missing`)
  stops and writes no status `(race)`.
- A handle source answered `not_found` stores `not_found`, keeps the handle's rows and pages,
  prunes nothing, tries no other credential, and is retried on the next sync. (The `404 →
  not_found` mapping is [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s; the row status is
  [data model](../required-tests.md#model-tests)'s.)
- A sync run reconciles the handle when it starts and fetches the current, normalised handle;
  with no handle there is no handle source. (Its URL-encoding is
  [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s.)
- A handle changed while a run is fetching it: the
  [edge-case scenario](../edge-cases.md#required-tests).

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
  redirect is followed is [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s.)

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
  cleanup tests of [data model](../required-tests.md#model-tests).

**Pruning:**

- Pruning runs in the end-of-sync transaction; a failed or interrupted source blocks pruning of
  its repos by keeping its rows. (The pruning query itself is
  [data model](../required-tests.md#model-tests)'s.)

**Rate limits:**

- A `rate_limited` source is skipped while its `resetAt` is in the future, Refresh included: no
  call, status, `resetAt` and rows kept.
- A refused budget acquire (a `rate_limited` result with no GitHub call) marks the
  unauthenticated source `rate_limited` with that reset and keeps its rows. (The tracker itself is
  [GitHub service](../../integrations/github-service/required-tests.md#required-tests)'s.)

**Integration deletion:**

- The end-of-sync safety net drops the source, page and status rows of an integration deleted
  during the sync (a page answer released after the deletion hook's cleanup, or a failed
  listener), before pruning; every statement is scoped by `user_id`, and a still-existing
  non-usable integration's rows are kept `(race)`.

**Values:**

- The defaults apply, and the three env vars override the TTL, the cooldown and the page cap; a
  value that is not a positive integer falls back to the default `(unit)`.
