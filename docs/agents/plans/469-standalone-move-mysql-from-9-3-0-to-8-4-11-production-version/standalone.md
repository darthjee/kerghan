# Standalone Plan: Standalone: move MySQL from 9.3.0 to 8.4.11 (production version)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Inner compose:**
  - `mysql` uses `mysql:8.4.11` on volume `mysql84-data`.
  - `mysql-legacy` uses `mysql:9.3.0` on volume `mysql-data`, with profile `migrate-mysql-9`, the same env and healthcheck, and no restart policy.
- **Offline:** `mysql-legacy.tar` is provided by infra in `standalone/images/<arch>/` for this release only.

## Steps

- [01 — Inner compose: 8.4.11 on a new volume, plus mysql-legacy](standalone/01-inner-compose.md)
- [02 — Client: detect and migrate 9.x data](standalone/02-client-migration.md)
- [03 — bats tests](standalone/03-tests.md)
- [04 — Smoke test, Dockerfile comment and docs](standalone/04-smoke-and-docs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`) and `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`).

## Notes

- **Brief empty-DB window:** Vault runs `compose up` on boot, so the backend starts once on the empty `mysql84-data` volume and runs its migrations before the client stops it. The restore drops and recreates the `kerghan` database, which removes anything written in that window. Keep the window short by stopping `kerghan` before starting `mysql-legacy`, and say so in the output.
- **Credentials:** the dump and restore use the MySQL root password (`KERGHAN_MYSQL_PASSWORD`, which defaults to `kerghan`). Pass it only through the inner container env: `compose exec` with `MYSQL_PWD` taken from the container's own environment, never on a host command line or in client output.
- **Dump location:** the dump stays inside the Vault container's data volume (for example under the `mysql84-data`/legacy containers' `/tmp`, or streamed through a pipe between `compose exec` calls). It is never copied to the host. If it is a file, it is deleted with the old volume after verification.
- **Downgrade:** downgrading to an older release after the migration is unsupported, because the old volume is gone and the old compose would start 9.3 on a missing volume, i.e. an empty database. `update_downgrade_hint` and `docs/agents/standalone/client-update.md` must say so.
