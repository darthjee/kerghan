# Worker schema naming helpers

Add pure helpers to `db-tier-options.ts`, next to `assertTestDatabase`, so the naming rules can be unit-tested without MySQL:

- `workerSchemaName(base: string, workerId: number): string`: runs `assertTestDatabase(base)`, strips the trailing `_test`, appends `_w<workerId>_test`, then runs `assertTestDatabase` on the result. Throws when `workerId` isn't a positive integer.
- `workerSchemaNames(base: string, maxWorkers: number): string[]`: the names for workers `1..maxWorkers`.
- `resolveWorkerId(env: NodeJS.ProcessEnv, maxWorkers?: number): number`: parses `JEST_WORKER_ID`. Throws a clear error when it is unset, not numeric, or (when `maxWorkers` is given) out of range. Never falls back to the base schema.
- `workerGrantPattern(base: string): string`: the GRANT database pattern. Escapes `_` and `%` in the prefix, then appends `\_w%\_test`; for example `kerghan_test` gives `kerghan\_w%\_test`.

Extend `db-tier-options.spec.ts` (unit tier) with cases for: worker 1 and worker 3 names, a bad base name rejected, a missing, non-numeric or out-of-range worker id rejected, the list of names for `maxWorkers = 3`, and escaping in the grant pattern (a prefix containing `_`). The existing assertions stay unchanged.

## Files to Change
- `backend/src/database/tests/db-tier/db-tier-options.ts`: add the four helpers, with JSDoc.
- `backend/src/database/tests/db-tier-options.spec.ts`: add the unit cases.
