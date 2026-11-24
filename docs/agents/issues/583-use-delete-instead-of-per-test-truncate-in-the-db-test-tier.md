Part of #582.

## Problem
`truncateAll` (`backend/src/database/tests/db-tier/db-tier.ts`) runs before each of the ~993 DB-tier tests. It queries `information_schema` and issues one `TRUNCATE TABLE` (DDL in MySQL 8) per table plus two `FOREIGN_KEY_CHECKS` statements. Measured locally: 36 ms per call on 19 tables (about 36 s per run); `DELETE FROM` over the same empty tables takes 3 ms.

## Measured result
Swapping `TRUNCATE TABLE` for `DELETE FROM` took the full suite from 115.6 s to 91.8 s with all 993 tests passing (tmpfs MySQL; CI likely gains more).

## Work
- Replace the per-test `TRUNCATE` with `DELETE FROM` (foreign-key checks still disabled on the same connection), leaving the `migrations` table alone.
- Cache the table list once per test file instead of querying `information_schema` before every test.
- `DELETE` does not reset auto-increment IDs: check no spec relies on specific IDs or on ordering that depends on a reset (consider `ALTER TABLE ... AUTO_INCREMENT = 1` only where needed).

## Acceptance
- All DB-tier specs pass.
- Record before/after durations of the `DB tests` step in CI.

## Scope
- In scope: `truncateAll` in `backend/src/database/tests/db-tier/db-tier.ts` (use `DELETE FROM`, cache the table list per test file).
- Out of scope: parallel workers (#585), MySQL flags (#584), harness and per-file set-up cost.

## Alternatives considered
- `DELETE` only from tables that have rows (cheaper still, needs a row-presence check): optional follow-up.
- Rolling back a transaction per test: not viable, since the harnesses use several connections and the race specs need real commits.

## Edge cases
- `DELETE` does not reset auto-increment. A full run with `DELETE` passed all 993 tests even though IDs keep climbing across tests, so no spec depends on a reset; repeat the run to rule out flakiness.
- Table cache: the DB tier migrates only in `globalSetup`, so the table set cannot change mid-file.
- Keep excluding the `migrations` table (emptying it makes migrations re-run on the next start).

## Backward compatibility
Test infrastructure only; no application behavior change.

## Testing strategy
- Full `yarn test:db` passes three runs in a row.
- Record the `DB tests` step duration in CI before and after.

## Performance and security
- Measured: 36 ms to 3 ms per call; full suite 115.6 s to 91.8 s locally (tmpfs MySQL).
- No security surface; the `_test` database-name guard is unchanged.
