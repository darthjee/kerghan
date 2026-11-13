# docker-compose services and Make target

1. **`kerghan_mysql`:** `image: mysql:9.3.0` becomes `mysql:8.4.11`. Nothing else changes.
2. **New `kerghan_mysql_test`:**
   - `image: mysql:8.4.11`;
   - environment `MYSQL_DATABASE=kerghan_test`, `MYSQL_USER=kerghan`, `MYSQL_PASSWORD=kerghan`, `MYSQL_ROOT_PASSWORD=kerghan`;
   - `tmpfs: /var/lib/mysql`, for a throwaway, fast store;
   - no published port and no `env_file`, so dev `.env` values never leak in.
3. **New `kerghan_db_tests`** runner:
   - `<<: *base`;
   - `links: [kerghan_mysql_test:mysql_test]`, which overrides the anchor's link;
   - `depends_on: [base_build, kerghan_mysql_test]`;
   - `environment` overriding `KERGHAN_MYSQL_HOST=mysql_test`, `KERGHAN_MYSQL_PORT=3306`, `KERGHAN_MYSQL_USER=kerghan`, `KERGHAN_MYSQL_PASSWORD=kerghan` and `KERGHAN_MYSQL_NAME=kerghan_test` (the `environment` values win over `env_file`);
   - `command: yarn test:db`.
4. **`Makefile`:** add `db-tests` to `.PHONY` and a target `docker-compose run --rm $(PROJECT)_db_tests`, next to `tests`.

## Files to Change
- `docker-compose.yml`: bump `kerghan_mysql`, and add `kerghan_mysql_test` and `kerghan_db_tests`.
- `Makefile`: the `db-tests` target.
