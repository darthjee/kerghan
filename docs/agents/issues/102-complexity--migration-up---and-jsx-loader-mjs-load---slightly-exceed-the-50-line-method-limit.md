# Issue: Complexity: migration up() and jsx-loader.mjs load() slightly exceed the 50-line method limit

## Description
Codacy's Lizard `nloc-medium` check flags two unrelated methods for slightly
exceeding the 50-line-of-code limit:

1. `backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts:13`
   — `up()` has 52 lines of code (limit is 50).
2. `frontend/specs/support/jsx-loader.mjs:44` — `load()` has 55 lines of code
   (limit is 50).

## Problem
- The migration's `up()` builds the `auth_authorization_requests` table
  definition (13 columns) and then creates four indexes, all inline in one
  method body — readable, but just over the line-count limit.
- `jsx-loader.mjs`'s `load()` is a chain of five independent `if` branches
  (raw-text imports, `.jsx` transform, stylesheet stubs, image stubs, and the
  `import.meta.env` shim for plain `.js` modules), each already self-contained
  but kept inline in the same function.

## Expected Behavior
Both methods pass the Lizard `nloc-medium` check (≤ 50 lines) with no change
in behavior:
- Migrations still apply and roll back cleanly.
- The Jasmine spec loader still resolves and transforms modules exactly as
  before (JSX transform, `?raw` imports, CSS/image stubs, `import.meta.env`
  shim).

## Solution
- **Migration**: extract the column list and/or index creation into small
  local helper functions or constants within the same file, so `up()` reads
  as a short sequence of calls. Keep `down()` untouched — it already just
  drops the table.
- **jsx-loader.mjs**: extract one or more of the five branches in `load()`
  (e.g. the `.jsx`-transform branch and/or the `import.meta.env`-shim branch)
  into private helper functions in the same file.

Verify with:
- `make setup` (migrations still apply cleanly)
- `docker-compose run --rm kerghan_fe yarn test` (Jasmine spec loader still
  works)

## Benefits
- Brings both files under the project's complexity limit.
- Keeps the migration's `up()`/`down()` easy to diff against each other.
- Makes `jsx-loader.mjs`'s independent transform steps easier to read and
  test in isolation.
