# Issue: Standalone: move MySQL from 9.3.0 to 8.4.11 (production version)

## Description

Move the standalone distribution's MySQL from `mysql:9.3.0` to `mysql:8.4.11`, the version production runs. #462 already moved dev, the DB-backed test tier and CI to 8.4.11. This issue covers the standalone image, plus a one-time data migration for existing installs.

## Problem

These files still pin `mysql:9.3.0`, which differs from production and from the version tests run against:
- `standalone/vault/docker-compose.yml`
- `standalone/scripts/smoke_test.sh`
- `bin/release_kerghan_standalone.sh` (`MYSQL_IMAGE`)
- the comment in `dockerfiles/kerghan_standalone/Dockerfile`
- `docs/agents/standalone.md`
- `docs/agents/architecture/infra.md`
- `.claude/agents/infra.md`

MySQL cannot downgrade a data directory: an 8.4 server will not start on an existing 9.3 data directory. Existing installs therefore cannot just switch images. The `darthjee/vault` base image has no pre-start hook, so the Vault container cannot migrate the data on boot.

## Expected Behavior

- **New image:** standalone ships `mysql:8.4.11`, and every reference listed above is updated to match.
- **Migration in `kerghan update`:** `kerghan update --finish` (and the restart that follows it) checks the inner `mysql-data` volume in `vault-kerghan` for 9.x data. If it finds any, it migrates the data with `docker exec` into the Vault container before the stack starts on 8.4.11:
  1. Start a temporary `mysql:9.3.0` server on the old volume, and take a logical dump (`mysqldump` of the `kerghan` database).
  2. Initialize a fresh 8.4.11 volume and restore the dump.
  3. Start the stack on 8.4.11 and verify that it is healthy and the backend migrations pass.
  4. Only then delete the old 9.3 volume and the dump.
- **Failure safety:** if any step fails, the 9.3 data stays untouched. The client exits non-zero with a clear message and a hint, and nothing is deleted. Nobody loses data silently.
- **Fresh installs** skip the migration.
- **Old image source:** this release's offline variant also bundles `mysql:9.3.0`, used only by the migration, and the online variant pulls it on demand. A later release drops the extra image.
- **Docs and release notes:** `docs/agents/standalone.md` documents the migration, and the release notes call out the change, including that the migration runs on `kerghan update`. Users who run the image without the client need a documented manual procedure.
- **Tests:** bats coverage in `standalone/test/` (for example `update.bats` and `upgrade.bats`, with Docker stubbed) covers detection, the success path, each failure path (with nothing deleted), and the fresh-install skip. The smoke test checks for `mysql:8.4.11`.

## Solution

- **Standalone agent:** `standalone/` (the `kerghan` client, the inner compose file, the smoke test, bats tests) and `dockerfiles/kerghan_standalone/`.
- **Infra agent:** `bin/release_kerghan_standalone.sh` (bundling `mysql:8.4.11`, plus `mysql:9.3.0` for this release's offline variant), any CircleCI or release-job changes, and `.claude/agents/infra.md` / `docs/agents/architecture/infra.md`.
- This needs a new release.
