# Infra docs, dev reset note and epic README

- **`docs/agents/architecture/infra.md`:**
  - `## CI jobs` describes `backend_db_tests`: its MySQL service container, its env, and that it gates the release and deploy jobs;
  - add a short **"MySQL version"** note: dev, test and CI use `mysql:8.4.11`, which matches production, and standalone moves in #469;
  - add the **one-time dev reset**:

    ```sh
    docker-compose stop kerghan_mysql
    rm -rf docker_volumes/mysql_data
    docker-compose up -d kerghan_mysql
    make setup
    ```

    `make setup` runs `yarn migration:run`.

  The issue allows this exception to the "no permanent docs" rule.
- **`.claude/agents/infra.md`:** in the services table, set `kerghan_mysql` to `mysql:8.4.11` and add rows for `kerghan_mysql_test` and `kerghan_db_tests`.
- **`docs/agents/specs/repos/README.md`:**
  - add the #462 row to "Sub-issues": `| #462 | Repositories: Infra — DB-backed test tier and MySQL CI job | implementation: [testing.md](testing.md#db-backed-tier); spec sync in [testing.md](testing.md) |`;
  - in the fold-in list, change the `architecture/infra.md` bullet from `cimg/mysql:8.0` to `mysql:8.4.11` and note that #462 already wrote it.
- **PR description** (for whoever opens the PR): include the dev reset steps and "requires a new release".

## Files to Change
- `docs/agents/architecture/infra.md`: the CI job, the MySQL version and the dev reset.
- `.claude/agents/infra.md`: the services table.
- `docs/agents/specs/repos/README.md`: the sub-issue row and the fold-in bullet.
