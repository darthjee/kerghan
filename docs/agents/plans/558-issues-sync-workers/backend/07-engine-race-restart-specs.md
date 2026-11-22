# Engine, race and restart specs

The specs required by `testing.md#worker-tests` and `testing.md#races` that are not covered by the unit specs of the earlier steps:

- **`(engine)` on the real `WorkersService` and deku-swarm** (use `resetDekuSwarm()`):
  - registration by name;
  - a retry after `_fail`;
  - exhaustion marking `sync_failed` with `retries_exhausted` (E18);
  - a rate-limited job finishing without `_fail` (E17).
- **`(db)` restart (E14, E51, E16):**
  - Seed links with markers and build a fresh module over the same database with a new `FakeWorkersService`.
  - Run the boot hook. Each marker is enqueued exactly once, oldest first.
  - A second job for the same link is a no-op.
  - A waiting refresh with no marker is lost.
- **`(race)` scripted interleaving** with `FakeIntegrationsGithubService.hold()` deferreds and `FakeWorkersService`:
  - an edit during a push (E41) and during a refresh (E10);
  - unlink, project delete or user delete during a push (E44, E32);
  - an edit against the job that sets `gone` (E1);
  - duplicate jobs (E13);
  - a crash before the clear (E15).
- **Idempotence** (E13, E15).

## Files to Change

- `backend/src/issues/tests/issues-reconcile.engine.spec.ts` (new)
- `backend/src/issues/tests/issues-sync.restart.db-spec.ts` (new)
- `backend/src/issues/tests/issues-sync.race.db-spec.ts` (new)
