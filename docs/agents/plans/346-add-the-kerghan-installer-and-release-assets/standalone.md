# Standalone Plan: Add the kerghan installer and release assets

Main plan: [plan.md](plan.md)

## Shared contracts

- `standalone/install.sh` carries the stamp line `KERGHAN_VERSION="<x.y.z>"` (line form
  `^KERGHAN_VERSION="[0-9.]*"$`, rewritten by infra's `bump_version.sh`). The user's
  `KERGHAN_VERSION` is captured into `requested_version` *before* that line.
- `VAULT_VERSION="0.1.0"` in `install.sh` equals the `darthjee/vault` tag in
  `dockerfiles/kerghan_standalone/Dockerfile`.
- Client URL: `https://github.com/darthjee/kerghan/releases/download/<version>/kerghan`. Vault
  installer URL: `https://raw.githubusercontent.com/darthjee/vault/<VAULT_VERSION>/install.sh`.
- Infra uploads `standalone/install.sh`, `standalone/bin/kerghan` and `standalone/config.example`
  as they are, so no build step may be needed for them.

## Steps

- [01 — Write the installer](standalone/01-write-installer.md)
- [02 — Test the installer](standalone/02-test-installer.md)
- [03 — Update the standalone specs](standalone/03-update-specs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, i.e.
  `bats standalone/test` on `bats/bats:1.11.0`)

## Notes

- The `standalone_tests` image is Alpine (busybox). The installer and its stubs must not rely on
  GNU-only flags. The installer must also stay bash 3.2 compatible, because it runs on macOS.
- Do not touch `.circleci/config.yml`, `bin/` or `scripts/`. Those belong to infra.
- Dropping `kerghan.env.example` was a product decision taken on the issue. Pass-through
  variables (for example the MySQL password override) users can add to `~/.kerghan/kerghan.env`
  stay documented in the "Standalone" section of `environment-variables.md`, written by #347.
