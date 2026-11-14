# Infra Plan: Standalone: move MySQL from 9.3.0 to 8.4.11 (production version)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Main tarball:** `mysql.tar` now holds `mysql:8.4.11`.
- **Migration tarball:** a new `mysql-legacy.tar` holds `mysql:9.3.0` in `standalone/images/<arch>/` for this release only. Vault loads every `*.tar`, so the offline variant has both images.

## Implementation Steps

### Step 1 — Release script bundles 8.4.11 plus the legacy image
In `bin/release_kerghan_standalone.sh`, set `MYSQL_IMAGE=mysql:8.4.11` and add `MYSQL_LEGACY_IMAGE=mysql:9.3.0`. Save it in `save_images` as `save_image "$arch" "$MYSQL_LEGACY_IMAGE" mysql-legacy`, for both architectures (`mysql:9.3.0` is multi-arch). Next to it, add a comment saying it exists only for the #469 migration and goes away together with the compose `mysql-legacy` service. If the CircleCI `release-kerghan-standalone` job holds image lists or release-notes text, update it the same way. Otherwise leave `.circleci/config.yml` untouched.

### Step 2 — Infra docs
- **`docs/agents/architecture/infra.md`:** replace "The standalone image still bundles `mysql:9.3.0`; it moves in #469." with a line saying standalone uses `mysql:8.4.11` (with `mysql:9.3.0` bundled only for the one-time migration), linking to the standalone migration section.
- **`.claude/agents/infra.md`:** the `kerghan_mysql` row becomes `mysql:8.4.11` (dev has already used 8.4.11 since #462).

## Files to Change
- `bin/release_kerghan_standalone.sh` — `MYSQL_IMAGE` and the legacy tarball.
- `docs/agents/architecture/infra.md` — the standalone MySQL note.
- `.claude/agents/infra.md` — the image table row.
- `.circleci/config.yml` — only if the release job lists images or release notes.

## CI Checks
- Shell lint, if configured for `bin/`. There is no unit suite for the release script; check it by reading it, or with a dry run if the script supports one.

## Notes
- The release job's offline image grows by one MySQL image for this release. The follow-up that drops `mysql-legacy` removes it again.
