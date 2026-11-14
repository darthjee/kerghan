# Plan: Standalone: move MySQL from 9.3.0 to 8.4.11 (production version)

Issue: [469-standalone-move-mysql-from-9-3-0-to-8-4-11-production-version.md](../../issues/469-standalone-move-mysql-from-9-3-0-to-8-4-11-production-version.md)

## Overview

The standalone inner stack moves to `mysql:8.4.11` on a **new** inner volume. The old 9.3 volume stays declared, but only a profile-gated `mysql-legacy` service (`mysql:9.3.0`) mounts it. Once the new instance is up, the client migrates the data. It is called from `cmd_up`, so `kerghan update`'s restart and a later manual `kerghan up` both run it. The client stops the inner backend, starts `mysql-legacy`, dumps the `kerghan` database, restores it into 8.4.11 and starts the backend again. It checks health and row counts, and deletes the old volume only after those checks pass. The release script bundles `mysql:9.3.0` as an extra tarball for this release's offline variant.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Images:** the main inner MySQL is `mysql:8.4.11`, and the migration-only image is `mysql:9.3.0`.
- **Inner compose (`standalone/vault/docker-compose.yml`):**
  - Service `mysql` uses `image: mysql:8.4.11` on the new volume `mysql84-data`, mounted at `/var/lib/mysql`.
  - Service `mysql-legacy` uses `image: mysql:9.3.0` with `profiles: [migrate-mysql-9]` and the old volume `mysql-data`, mounted at `/var/lib/mysql`. It has the same credentials env and healthcheck as `mysql`, no published port and no `restart` policy.
  - Top-level volumes: `mysql84-data: {}` and `mysql-data: {}`. The old volume keeps its name, so its data stays where existing installs left it.
- **Offline tarballs** in `standalone/images/<arch>/`: `kerghan.tar`, `mysql.tar` (now `mysql:8.4.11`), `tent.tar`, plus the new `mysql-legacy.tar` (`mysql:9.3.0`) for this release only. Vault's `docker load` loads every `*.tar`, so no Dockerfile logic changes, only comments. Because `--pull never` is set, the offline migration depends on `mysql-legacy.tar`.
- **Removal later:** a future release drops `mysql-legacy`, the `mysql-data` declaration and `mysql-legacy.tar` together. A follow-up issue tracks that.
