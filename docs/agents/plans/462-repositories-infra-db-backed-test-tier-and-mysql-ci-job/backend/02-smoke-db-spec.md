# Smoke db-spec, lint and default-run isolation

Prove the tier works before #463 depends on it.

1. **`backend/src/database/tests/db-tier.db-spec.ts`:**
   - **migrations applied:** the `migrations` table holds one row per `src/database/migrations/[0-9]*.ts` file, and there are no pending migrations (`showMigrations()` is false);
   - **round trip:** insert an `auth_users` row with raw SQL and read it back with the same values, including a `bigint`-sized or unicode field if one exists, to prove the column types survive;
   - **truncation:** two tests in order, the first inserting a row and the second asserting `auth_users` is empty. This relies on `--runInBand` and Jest's in-file order;
   - **guard:** `assertTestDatabase('kerghan')` throws, and `assertTestDatabase('kerghan_test')` does not.
2. **ESLint:** add `'**/*.db-spec.ts'` to the test-file override in `backend/eslint.config.mjs` (the block with `files: ['**/*.spec.ts', '**/*.e2e-spec.ts']`), so db-specs get the same test rules.
3. **Unit test of the pure helpers:** the guard and the env-to-options mapping in `db-tier-options.ts` also get a plain `*.spec.ts`, so the default suite (and its coverage) covers them without a database. Alternatively, keep `database/**` out of coverage, as it already is, and test them only in the smoke spec. Prefer the unit spec.
4. Check that the default `yarn coverage` run does not pick up the db-spec and stays green.

## Files to Change
- `backend/src/database/tests/db-tier.db-spec.ts`: new, the smoke spec.
- `backend/src/database/tests/db-tier-options.spec.ts`: new, the unit spec for the guard and options.
- `backend/eslint.config.mjs`: include `*.db-spec.ts` in the test override.
