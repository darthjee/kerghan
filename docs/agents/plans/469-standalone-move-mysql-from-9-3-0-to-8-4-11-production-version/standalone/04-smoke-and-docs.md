# Smoke test, Dockerfile comment and docs

- **`standalone/scripts/smoke_test.sh`:** the header comment and the image check loop switch to `mysql:8.4.11`. For a fresh smoke run, `mysql:9.3.0` must not be pulled, so assert it is absent.
- **`dockerfiles/kerghan_standalone/Dockerfile`:** update the offline-stage comment (`mysql:8.4.11`, plus `mysql:9.3.0` as `mysql-legacy.tar` for the migration release).
- **`docs/agents/standalone.md`:**
  - In the inner-stack table, show `mysql` as `mysql:8.4.11` on `mysql84-data`, and add a `mysql-legacy` row.
  - In the online/offline variants, list the images and the extra tarball.
  - Add a "MySQL 9.3 → 8.4.11 migration" section covering when it runs (`kerghan up`, including via `kerghan update`), its steps, the verify-then-delete rule, failure and retry, and that a downgrade is unsupported.
  - Add a **manual procedure** for people who run the image without the client: the same `docker exec <vault> docker compose ...` commands, step by step.
- **`docs/agents/standalone/client-update.md`:** a note on the migration that runs during the restart, and the downgrade warning.
- **Release notes:** the release body or notes (wherever `release-kerghan-standalone` takes them from; coordinate with infra) calls out the MySQL change, the automatic migration on `kerghan update`/`kerghan up`, the brief backend restart during it, and that downgrading afterwards is unsupported.

## Files to Change
- `standalone/scripts/smoke_test.sh`
- `dockerfiles/kerghan_standalone/Dockerfile` (comment only)
- `docs/agents/standalone.md`
- `docs/agents/standalone/client-update.md`
