# Plan: Bump Tent to 1.3.0

Issue: [612-bump-tent-to-1-3-0.md](../../issues/612-bump-tent-to-1-3-0.md)

## Overview

Move every Tent pin from `1.0.3` to `1.3.0` in one PR, making the root `version` file's `tent=` line the single source of truth. Direct readers (release script, standalone Dockerfile, `.claude/scripts/check_proxy.sh`) read it; files that cannot read a file (compose, CircleCI, docs) hold copies kept in sync by a new `scripts/bump_tent.sh` and verified by `scripts/bump_tent.sh --check` in the existing `scripts_tests` CircleCI job. The per-architecture Tent tag machinery is replaced by one multi-arch tag plus a release-time guard. The bump is gated by the five-row security recheck (with an automated row-3 test) and three production pre-merge checks.

## Agents involved

- [infra](infra.md) — `version`, release script and guard, `bump_tent.sh` and its bats suite, compose / CircleCI pins, `check_proxy.sh`, infra docs, production pre-merge checks.
- [standalone](standalone.md) — standalone Dockerfile (`standalone` stage), smoke test, inner compose header comment, standalone docs.
- [proxy](proxy.md) — proxy suite and lint on Tent 1.3.0, the row-3 regression test, the security recheck and `security.md`.

Order: infra step 01 first (the `version` line every other part reads), then standalone and infra 02–03 in parallel, then proxy (it needs the bumped compose images), then infra 04 (pre-merge checks, recorded in the PR together with proxy's verdicts).

## Shared contracts

1. **Source of truth.** The root `version` file gains the line `tent=1.3.0` (after `vite_kerghan-base=0.1.2`). It covers both `darthjee/tent` and `darthjee/tent-test`. Canonical lookup, matching `bin/image.sh`'s `image_version`:

   ```bash
   grep '^tent=' version | sed -e 's/^tent=//'
   ```

   Every reader treats an empty result as an error with an explicit message naming `version` and `tent=`.

2. **Synced-copy pattern.** A synced copy is any occurrence of `darthjee/tent:X.Y.Z` or `darthjee/tent-test:X.Y.Z` where `X.Y.Z` is followed by end of line, whitespace or a backtick. Suffixed tags (`-arm64`), `:latest`, and any `TENT_VERSION=`-style literal are **not** copies. After this change neither the release script nor the standalone Dockerfile contains a literal Tent version.

3. **`scripts/bump_tent.sh` file list (synced copies).** `docker-compose.yml`, `.circleci/config.yml`, `docs/agents/architecture/infra/ci-jobs.md`, `.claude/agents/proxy.md`, `.claude/agents/infra.md`. Never `docs/agents/architecture/security.md` and never `docs/agents/external/tent/*`. If a standalone or infra prose doc keeps a literal Tent version after its rewrite, it is added to this list (standalone tells infra which file and line).

4. **`/vault/.env` shape** (written by the `standalone` stage, asserted by `smoke_test.sh`): exactly the keys `TENT_IMAGE`, `KERGHAN_VERSION`, `LOGS_IMAGE`; `TENT_IMAGE` matches `^TENT_IMAGE=darthjee/tent:[0-9]+\.[0-9]+\.[0-9]+$` on both architectures.

5. **Build context.** The standalone Dockerfile reads `version` through `RUN --mount=type=bind,source=version,target=/tmp/version`; every build of it (release script `build_push`, `smoke_test.sh`) already uses the repository root `.` as context, so no caller changes and no `--build-arg TENT_VERSION` exists.

6. **Release guard.** `bin/release_kerghan_standalone.sh` gains `require_platform_manifest <arch> <image>`, which reuses `platform_digest` and fails with `<image> has no linux/<arch> manifest; Tent must be published as a multi-arch tag.` It runs before `save_image` for Tent inside `save_images()`.

7. **PR description sections** (filled by infra and proxy): Security recheck verdicts (rows 1–5, pass/fail each), Production pre-merge checks (host PHP vs Tent 1.3.0 minimum, image layout and tooling, `prod_configuration` / `locals.php` validity), rollback path.
