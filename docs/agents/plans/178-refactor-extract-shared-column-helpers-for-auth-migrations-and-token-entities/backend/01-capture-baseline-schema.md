# Capture baseline schema
Before touching any code, record the DDL the current migrations produce so step 04 can prove it is unchanged. Everything runs through `docker-compose`.

1. Build the backend (`docker-compose run --rm kerghan_app yarn build`) — migrations execute from `dist/`.
2. Start from a fresh database (drop and recreate the `kerghan` schema in `kerghan_mysql`, root password `kerghan`).
3. Run `docker-compose run --rm kerghan_app yarn migration:run`.
4. For every `auth_*` table, capture `SHOW CREATE TABLE <table>` into a baseline file (e.g. `baseline.sql`) kept in the scratchpad/temp area — not committed to the repo.

## Files to Change
- None committed (baseline dump is a temporary artifact outside the repo).
