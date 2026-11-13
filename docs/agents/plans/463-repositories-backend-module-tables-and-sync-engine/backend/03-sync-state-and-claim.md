# Sync state: row creation, claim, lease, release and handle reconciliation

Implement the per-user lock and the handle reconciliation (`sync.md#per-user-lock`, `#time-source`, `#restart-recovery`, `model.md#repositories_sync_states`, `model.md#handle-changes`, `model.md#user-deletion`) in a `SyncStateStore` (`repositories/sync-state.store.ts`). Every timestamp comes from `Clock`.

- **Row creation (request entry points only).** `ensureRow(userId)` runs one transaction:
  1. Call step 01's `lockExistingUser(userId, manager)`; with no user, create nothing and return `false`.
  2. Otherwise run `INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` (never `INSERT IGNORE`).
- **Claim.** `claim(userId, mode: 'stale' | 'refresh')`:
  - the conditional `UPDATE` of `sync.md#per-user-lock`: `idle`, or a dead lease (`heartbeat_at < now − lease`), and outside the cooldown; the `stale` mode adds the TTL clause on `last_synced_at`;
  - it sets `state = 'syncing'`, `last_started_at = heartbeat_at = now` and a fresh `run_id` (`crypto.randomUUID()`);
  - **zero rows:** re-read the row. A live `syncing` row means `running`. Idle and out of the cooldown means retry the claim once. Otherwise it is `cooldown`, with `lastStartedAt`. In `stale` mode, a row that is merely fresh is `fresh`.
  - It returns a typed outcome: `{ kind: 'started', runId } | { kind: 'running' } | { kind: 'cooldown', lastStartedAt } | { kind: 'fresh' }`.
- **Run-guarded writes.** Every write a run makes is conditional on `user_id = :userId AND run_id = :runId`:
  - `heartbeat(userId, runId)`;
  - `finish(userId, runId)`: `idle`, clear `run_id`, set `last_synced_at = now`;
  - `release(userId, runId)`: the catch-all; `idle` and clear `run_id`, but never set `last_synced_at`.

  Zero affected rows means the run lost its lease or its row; callers stop. Expose a `guard(manager, userId, runId)` that locks the row `FOR UPDATE` inside a page transaction and returns whether the run still owns it.
- **Lease read.** `readState(userId)` reports a `syncing` row whose heartbeat is older than the lease as `idle` (`sync.md#restart-recovery`). There is no boot-time reset.
- **Handle reconciliation** (`handle-reconciler.ts`):
  - It reads the current handle through `AccountHandleService#getGithubHandle` and compares it with `repositories_sync_states.handle`; a missing row counts as `null`.
  - If they differ, one transaction:
    1. creates the row if missing (request entry points only, through the same user-exists lock), then `SELECT … FOR UPDATE` and re-compare;
    2. deletes the `handle` source, page and status rows (each statement scoped `AND user_id = :userId`);
    3. sets `handle`;
    4. prunes, through step 04's `Pruner`.
  - It has two modes: `forRequest(userId)` may create the row; `forRun(userId)` only locks an existing row and returns "no row", so the run stops.
  - It triggers no sync and never touches `last_started_at`.
- **Tests:**
  - `(db)`: the claim in each mode (fresh, stale, running, inside the cooldown including right after a stale-triggered sync, a dead lease taken over); the zero-row re-read and its single retry; a zombie's `release` / `finish` / `heartbeat` affecting nothing once run B claimed; `ensureRow` not creating a row for a missing user; the reconciliation cases of `model.md#required-tests` "Handle changes"; `forRun` never creating the row.
  - `(db)` concurrency (type a): N concurrent claims give exactly one `started`; N concurrent `ensureRow` give one row; two concurrent reconciliations reconcile once.
  - Every time rule is driven by `FakeClock.set` / `advance`, never by waiting.

## Files to Change
- `backend/src/repositories/sync-state.store.ts`: new; row creation, claim, re-read, guarded writes, lease read.
- `backend/src/repositories/handle-reconciler.ts`: new.
- `backend/src/repositories/tests/sync-state.store.db-spec.ts`, `handle-reconciler.db-spec.ts`, `sync-claim.concurrency.db-spec.ts`: new.
