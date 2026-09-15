# Backend Plan: Complexity: migration up() and jsx-loader.mjs load() slightly exceed the 50-line method limit

Main plan: [plan.md](plan.md)

## Shared contracts

None — this fix is fully contained within the migration file.

## Implementation Steps

### Step 1 — Shrink `up()` in the auth-authorization-requests migration

`backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts:13`'s
`up()` is 52 lines: it inline-builds a 13-column `Table` definition, then
creates four indexes. Extract the column list into a local `COLUMNS` constant
(module-level, alongside the existing `TABLE_NAME`/`STATUS_ENUM` constants)
and/or extract the four `createIndex` calls into a local helper function
(e.g. `createIndexes(queryRunner)`), so `up()` itself reads as a short
sequence of calls. Do not change `down()` — it already just drops the table
— and do not change column names, types, defaults, nullability, or index
definitions; this is a pure extraction, not a schema change.

## Files to Change

- `backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts` —
  extract the column list and/or index-creation calls out of `up()` into
  module-level constants/helper functions, reducing `up()` to ≤ 50 lines with
  identical resulting schema.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests npm run coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests npm run lint` (CI job: `backend_checks`)
- Also run `make setup` locally to confirm the migration still applies cleanly.

## Notes

- Lizard's `nloc-medium` counts lines of code, not statements — verify the
  refactored `up()` is actually ≤ 50 lines (not just fewer statements) before
  considering this done.
