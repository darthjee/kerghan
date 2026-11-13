# Cross-module race scenarios and the Integrations `(db)` compare-and-set

These are the scripted-interleaving specs (type b, tag `(race)`, `testing.md#concurrency-and-races`). Each one:
1. pauses a run at a GitHub call with `FakeIntegrationsGithubService#hold(...)`, or keeps it in the `CapturingLauncher`;
2. performs the competing action;
3. resolves the deferred answer;
4. asserts.

Production code gets no test-only hooks.

- **`edge-cases.md#required-tests`**, one spec per scenario:
  - integration deleted mid-sync;
  - integration deleted and re-created with the same credential;
  - user deleted during a sync (no row remains, the sync-state row is not recreated);
  - an added public repo with no link turns private (linked to the oldest usable integration that returns it, or Unavailable);
  - credential replaced during a sync (`active`, then `pending`, then `ok`);
  - handle changed during a sync;
  - Add during a sync (the upsert keeps Add's `added_at` and link, and the link fill never overwrites it).
- **`sync.md#required-tests` `(race)` items:**
  - zombie writes: run A paused at a call, the clock advanced past the lease, run B started; A's page, end-of-source and end-of-sync writes are rejected, and A's catch-all never releases B's lock;
  - a source whose integration is deleted mid-sync (`missing`) writes no status;
  - the end-of-sync safety net drops rows a paused page wrote after the deletion hook's cleanup and keeps a still-existing non-usable integration's rows;
  - a run whose sync-state row was deleted stops and never recreates it;
  - the hard deadline passed between pages.
- **Integrations `(db)` compare-and-set** (moved from #461, `integrations.md#required-tests` "Status compare-and-set"): on the DB tier, `IntegrationStoreService#setStatusIfCredential` updates the status only while `secret_iv` still equals the iv used. A Replace (`rewriteSecret`) in between makes it affect no row, and the integration stays `active`.

Competing actions call the real services (the Integrations delete and replace, the reconciler after an Auth handle write, the `user.deleted` listener, `markAdded`) on the DB tier, wired by the step-02 harness.

## Files to Change
- `backend/src/repositories/tests/races/*.race.db-spec.ts`: new; one file per scenario group.
- `backend/src/integrations/tests/integration-store.compare-and-set.db-spec.ts`: new.
