# Infra Plan: Bump Tent to 1.3.0

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces the `tent=1.3.0` line in `version` and the canonical lookup (contract 1) — every other agent reads it.
- Owns the synced-copy pattern and file list (contracts 2–3) through `scripts/bump_tent.sh`; adds any prose doc standalone reports as still carrying a literal version.
- Owns the release guard (contract 6).
- Fills the "Production pre-merge checks" and "Rollback" sections of the PR description (contract 7).

## Steps

- [01 — Source of truth and release script](infra/01-version-and-release-script.md)
- [02 — bump_tent.sh with --check, and its bats suite](infra/02-bump-tent-script.md)
- [03 — Bump to 1.3.0, CI check step, infra docs](infra/03-bump-and-ci.md)
- [04 — Production pre-merge checks](infra/04-production-checks.md)

## CI Checks

- `scripts/`, `bin/`: `docker-compose run --rm scripts_tests` (CI job: `scripts_tests`, which also runs `scripts/bump_tent.sh --check`)
- `proxy/` via the bumped images: `docker-compose run --rm proxy_tests`, `docker-compose run --rm proxy_lint` (CI jobs: `proxy_extension_tests`; lint via Codacy)

## Notes

- `scripts_tests` runs on Alpine (`bats/bats:1.11.0`, BusyBox `sed`). `bump_tent.sh` must not use the BSD-only `sed -i ''` that `bump_vault.sh` / `bump_version.sh` use; write to a temp file and `mv` so it runs on macOS and inside its own bats suite.
- Model `bump_tent.sh` on `scripts/bump_vault.sh` (its `V` regex, `replace` helper, `git rev-parse --show-toplevel` root), not `bump_version.sh`.
- The deploy jobs run inside `darthjee/tent:<version>`; step 04 must confirm 1.3.0 still ships `bash`, `ssh`, `rsync` and the full `/var/www/html/` tree before merge.
