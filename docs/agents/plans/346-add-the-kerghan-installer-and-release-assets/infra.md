# Infra Plan: Add the kerghan installer and release assets

Main plan: [plan.md](plan.md)

## Shared contracts

- `standalone/install.sh` (written by standalone) has a stamp line matching
  `^KERGHAN_VERSION="[0-9.]*"$`, just like `standalone/bin/kerghan`.
- Release assets for tag `<v>`, exact basenames: `kerghan` (from `standalone/bin/kerghan`),
  `install.sh` (from `standalone/install.sh`), `config.example` (from
  `standalone/config.example`), `SHA256SUMS` (`sha256sum kerghan install.sh config.example`,
  bare basenames).
- New CircleCI project variable `GITHUB_TOKEN` (`contents: write` on `darthjee/kerghan`), read
  by `gh` directly.

## Steps

- [01 — Stamp the installer version on bump](infra/01-stamp-installer-version.md)
- [02 — Add the release-asset script](infra/02-release-assets-script.md)
- [03 — Add the CircleCI job and document it](infra/03-circleci-job-and-docs.md)

## CI Checks

- `.circleci/config.yml`: `circleci config validate` (via its Docker image, never on the host)
- `bin/release_kerghan_assets.sh`: `shellcheck` (via Docker)

## Notes

- The job only runs on semver tags. It cannot be exercised before a real release, so test the
  script locally with a stubbed `gh`, or against a throw-away tag on a fork, if you can.
- If `gh release create` races a manually created release, `gh release view` → create may fail
  with "already exists". Treat that error as success and continue to the upload.
