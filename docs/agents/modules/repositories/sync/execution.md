# Repositories — Sync: Trigger and Execution

Part of the [Repositories sync](../sync.md) doc, in the [Repositories module](../../repositories.md).

## Trigger

- **Stale:** the listing (`POST /repositories/mine.json`) starts a sync when the user's last
  sync is older than a TTL ([routes](../../../backend/routes/repositories/listing.md#stale-sync-trigger)).
- **Refresh:** the Refresh action forces a sync, subject to a **cooldown**; a Refresh inside it
  is refused (`429` with `Retry-After`, see [routes](../../../backend/routes/repositories/refresh-and-add.md#refresh)).
- **The cooldown runs from the start of the last sync, whatever triggered it** (stale listing or
  Refresh), and binds both: a stale listing inside the cooldown starts no sync
  ([routes](../../../backend/routes/repositories/listing.md#stale-sync-trigger)), whatever the TTL.
- **One sync per user at a time:** a trigger while a sync runs does not start a second one; a
  Refresh while syncing answers `202` with the running sync and does not reset the cooldown.
- Both triggers go through the same [atomic claim](#per-user-lock); the cooldown is anchored on
  `last_started_at`, set by every claim, whatever triggered it. A stale listing adds the TTL
  condition to the claim; a Refresh does not.
- No scheduled job, no background polling of GitHub.

## Execution

The sync is **asynchronous**: the request that triggers it does not wait for GitHub.

- The listing returns the stored rows immediately, with the sync state (`idle` / `syncing`,
  `lastSyncedAt`, per-source status; [routes](../../../backend/routes/repositories/identity-and-sync.md#sync-state)).
- The frontend polls `POST /repositories/sync/state.json` until it is `idle`, then reloads the
  page of rows ([routes](../../../backend/routes/repositories/identity-and-sync.md#polling-contract), [frontend](../frontend.md#sync-ux)). That route never
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
  ([Testing](../testing.md#detached-sync-and-time)).
- **No queue.** A job queue (BullMQ/Redis) would add infrastructure to dev, production and the
  standalone image for an on-demand, low-frequency job; rejected.
- **A sync stuck in `syncing` always returns to `idle`** ([restart recovery](#restart-recovery)),
  so polling always ends ([routes](../../../backend/routes/repositories/identity-and-sync.md#polling-contract)).

### Per-user lock

A **conditional `UPDATE`** on the user's sync-state row ([data model](../data-model.md#repositories_sync_states)),
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
  `last_started_at`; a stale listing starts no sync) ([routes](../../../backend/routes/repositories/refresh-and-add.md#refresh)). If the re-read
  finds the row idle and out of the cooldown (the run ended in between), the claim is retried
  once.
- A **stale listing** adds `AND (last_synced_at IS NULL OR last_synced_at < :now - ttl)` to the
  same claim; a Refresh does not. Both are bound by the cooldown clause.
- The row is created on first use, before the claim, with
  `INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` (a no-op on duplicate; not `INSERT IGNORE`,
  which would also hide other errors), so concurrent triggers (two tabs) never start two syncs.

### Time source

- **Injected `Clock`** (`now(): Date`, `backend/src/core/clock.ts`, provided as `SystemClock`;
  shared with the Integrations module, which added it in #461): the only time source of the
  Repositories module, never `Date.now()` / `new Date()` directly. Every time rule reads it: the TTL, the Refresh cooldown,
  the lease and its heartbeat, the hard deadline, `resetAt` checks of `rate_limited` sources, and
  the Add rate-limit window ([routes](../../../backend/routes/repositories/refresh-and-add.md#add-rate-limit)). Every timestamp the module writes
  (`last_started_at`, `heartbeat_at`, `last_synced_at`, `last_seen_at`, `synced_at`, `added_at`)
  comes from it.
- **No `NOW()` / `CURRENT_TIMESTAMP` in SQL time conditions.** Every time condition (lease
  expiry, TTL, cooldown, heartbeat) compares against an app-supplied timestamp parameter from the
  `Clock` (the `:now` of the claim above), so the application and the database never disagree
  about time, and tests drive both with one fake clock
  ([Testing](../testing.md#detached-sync-and-time)).

### Restart recovery

- **Heartbeat:** the running sync bumps `heartbeat_at` after every GitHub page
  ([write path](write-path.md#write-path)).
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

