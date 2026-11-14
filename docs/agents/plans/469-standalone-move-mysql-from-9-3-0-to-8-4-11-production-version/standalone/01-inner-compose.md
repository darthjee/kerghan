# Inner compose: 8.4.11 on a new volume, plus mysql-legacy

In `standalone/vault/docker-compose.yml`:
- Change `mysql` to `image: mysql:8.4.11`, mounting the new volume `mysql84-data` at `/var/lib/mysql`.
- Add `mysql-legacy` (`image: mysql:9.3.0`, `profiles: [migrate-mysql-9]`) on the old `mysql-data` volume. Give it the same `MYSQL_*` environment and `mysqladmin ping` healthcheck as `mysql`, no `restart`, and no `depends_on` from other services.
- Declare both volumes at the top level, and add a comment explaining that `mysql-legacy` exists only to migrate pre-#469 data and is removed in a later release.

Because the profile is off by default, a normal `compose up` never starts `mysql-legacy`, so fresh installs never pull or run 9.3.0. The inner `mysql-data` volume is still created as an empty, unused volume on fresh installs. Step 02's detection must account for that.

## Files to Change
- `standalone/vault/docker-compose.yml` — new volume for `mysql`, the `mysql-legacy` service, and the volume declarations.
