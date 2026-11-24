# Make the DB tier parallel-safe

Run the full tier in parallel through compose: 5 runs in a row at the default worker count, then 2 runs with `yarn test:db --maxWorkers=4`. Treat every failure that passes on rerun as a flake.

- Expected risk area: the race and concurrency specs (`src/issues/tests/races/*`, `src/repositories/tests/races/*`, `src/repositories/tests/sync-claim.concurrency.db-spec.ts`, `src/issues/tests/issues-sync.race.db-spec.ts`, `src/repositories/tests/repositories.routes.add-race.db-spec.ts`). They depend on timing inside one file and may behave differently under CPU contention.
- **Default fix:** make the spec deterministic, for example by awaiting explicit barriers or deferred promises instead of relying on timing. Never fix it by only raising timeouts.
- **Fallback, only if a spec can't reasonably be made parallel-safe:** turn `jest.db.config.ts` into two `projects` that share the same base, `globalSetup` and setup files. One runs in parallel; the other, `maxWorkers: 1`, takes an explicit list of excluded specs. Open a follow-up issue for each excluded spec, and list them all in the PR description.
- Also watch for "Too many connections" at 4 workers. If it shows up, lower the tier pool sizes (`buildDbTierOptions` `poolSize: 5`, `openEntityDataSource` `poolSize: 10`) and record the change.

If every spec passes all 7 runs, this step changes no files.

## Files to Change
- Whichever race or concurrency specs turn out to be flaky (unknown until measured).
- `backend/jest.db.config.ts`: only if the serial fallback is needed.
