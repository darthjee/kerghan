# Verify identical schema and run checks
Prove the refactor did not change the database schema, then run the project checks. All commands go through `docker-compose`.

1. Rebuild (`yarn build`) so `dist/` contains the refactored migrations and entities.
2. Recreate the `kerghan` database from scratch, run `yarn migration:run`, and capture `SHOW CREATE TABLE` for every `auth_*` table exactly as in step 01.
3. Diff against the baseline from step 01 — it must be empty. Any difference (column order, defaults, `ON UPDATE`, index names) means a helper or a migration edit is wrong and must be fixed.
4. Run `yarn migration:revert` repeatedly (once per migration, or until nothing is left to revert) to confirm `down()` still works, then re-run `yarn migration:run` once more.
5. Run `yarn lint` and the Jest suite (`yarn test` / `yarn coverage`) — the entity refactor must not break existing specs.
6. Optionally, re-run jscpd manually inside the app container (e.g. `docker-compose run --rm kerghan_app npx jscpd src/database src/auth/entities`) to confirm the blocks reported in the issue are gone. Do not install anything on the host.

## Files to Change
- None expected — this is a verification step. If the diff or a check fails, fix the offending file from step 02 or 03.
