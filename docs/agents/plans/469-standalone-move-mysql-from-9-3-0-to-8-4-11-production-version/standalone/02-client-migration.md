# Client: detect and migrate 9.x data

Add a `mysql_migrate_if_needed` function (with small helpers) to `standalone/bin/kerghan`. `cmd_up` calls it after the instance is up and healthy, on both the start and the already-running paths. Since `update_restart` runs `cmd_up`, `kerghan update` and a later `kerghan up` both migrate. Every Docker call goes through `vault_cmd compose ...` (and `docker exec`/`vault` only where `vault_cmd` cannot), so the bats stubs see every call.

**Detection:** a migration is pending when the old inner volume `mysql-data` exists and holds a MySQL data directory, for example when `mysql-legacy` would find `/var/lib/mysql/mysql.ibd` or `ibdata1`. On fresh installs the volume is missing or empty, so the function skips. Checking only that the volume exists is not enough, because compose creates it empty. Keep the check cheap: use one `compose run --rm --no-deps` of a tiny command in `mysql-legacy`'s image, or `docker volume inspect` plus a file test inside the Vault container.

**Migration** (print a short progress line for each step):
1. `compose stop kerghan`, so the backend stops writing to the empty 8.4 database.
2. `compose --profile migrate-mysql-9 up -d mysql-legacy`, then wait for it to report healthy, with a bounded timeout. On the online variant compose pulls `mysql:9.3.0`; on the offline variant it is preloaded from `mysql-legacy.tar`.
3. Dump the `kerghan` database with `mysqldump --single-transaction --routines --triggers --databases kerghan` inside `mysql-legacy`. Also record per-table row counts, from `SELECT COUNT(*)` for each base table.
4. In `mysql`, run `DROP DATABASE kerghan; CREATE DATABASE kerghan;`, restore the dump, and grant the `kerghan` user its privileges again if the dump does not carry them.
5. Stop and remove `mysql-legacy`, without its volume. Then run `compose start kerghan`, wait for the backend to be healthy (reuse whatever readiness check `cmd_up` already has), and compare row counts with step 3. The backend's own migrations may add rows to `migrations`, so compare user tables only, excluding the TypeORM migrations table.
6. **Verify, then delete:** only once the health check and every count match, remove the old volume (`docker volume rm <project>_mysql-data` inside Vault) and any dump file, then print `MySQL data migrated from 9.3 to 8.4.11; the old 9.3 data was removed`.

**Failure:** if any step fails, stop, leave the old `mysql-data` volume untouched, stop `mysql-legacy`, and exit non-zero with an `error` and a `hint`. The hint should say to retry with `kerghan up` and that the 9.3 data is still kept. A retry has to be idempotent: detection still finds the old volume, and step 4 drops and recreates the database again.

The client must not log credentials. Take `MYSQL_PWD` from each container's own environment, via `sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump ...'` inside the container.

Also update `update_downgrade_hint` (or add a warning) so a downgrade below this release says the migrated 8.4 data cannot be read by older releases.

## Files to Change
- `standalone/bin/kerghan` — `mysql_migrate_if_needed` and helpers, the call from `cmd_up`, and the downgrade hint.
