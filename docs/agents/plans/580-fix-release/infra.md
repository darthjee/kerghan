# Infra Plan: Fix release

Main plan: [plan.md](plan.md)

## Overview
`darthjee/node:0.3.0` and `darthjee/circleci_node:0.3.0` are real multi-arch manifest lists (amd64 + arm64); `0.2.1` of both is single-arch amd64. Pin the base images on `0.3.0`, publish new base versions so the broken `0.1.0` / `0.1.0-arm64` tags are never overwritten, update every pin, and cut 0.10.1 with `scripts/bump_version.sh`.

## Context
See the issue's Root cause, Scope, Edge cases and Release steps. The `save_image` architecture check in `bin/release_kerghan_standalone.sh` stays as is. Already published images are left untouched.

## Implementation Steps

### Step 1 — Bump the base image and the base versions
- In `dockerfiles/base/Dockerfile`, change `ARG NODE_IMAGE_VERSION=0.2.1` to `0.3.0` (it feeds both `darthjee/node` and `darthjee/circleci_node`).
- In `version`, bump all four entries (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`) from `0.1.0` to `0.1.1`.

### Step 2 — Update every pin to the new base versions
- `.circleci/config.yml`: the four `darthjee/circleci_kerghan-base:0.1.0` references (`backend_tests`, `backend_checks`, and the two job executors) and the two `darthjee/vite_kerghan-base:0.1.0` references become `0.1.1`. `darthjee/circleci_node:0.2.1` (`jasmine`, `frontend-checks`) is CI-only/amd64 and may stay.
- `dockerfiles/kerghan_standalone/Dockerfile`: `FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.0` and the comment above it become `0.1.1`.
- Docs that quote the versions: `docs/agents/architecture/infra/ci-jobs.md`, `docs/agents/standalone/inner-stack.md`, `.claude/agents/infra.md`. Fix the `AGENTS.md` line saying the backend base family is not published to Docker Hub only if it is touched anyway.

### Step 3 — Bump the release version
Run `scripts/bump_version.sh 0.10.1` (README, both `package.json`, client CLI and installer pins, `dockerfiles/production_kerghan/Dockerfile`'s `FROM darthjee/kerghan:0.10.1`) in this same PR.

### Step 4 — Manual first publish (STOP: ask the user)
The PR's CI pulls `circleci_kerghan-base:0.1.1`, which does not exist until published, and `release-image` skips on non-tag builds. Before expecting CI to pass, **stop and ask the user** to publish the four new base images, amd64 and `-arm64`, with `FORCE_IMAGE_BUILD=1 bin/image.sh push <image> [arm64]` (needs their Docker Hub login; arm64 builds run under QEMU). Do not work around it. Resume once the user confirms.

## Files to Change
- `dockerfiles/base/Dockerfile` — `NODE_IMAGE_VERSION` 0.2.1 → 0.3.0.
- `version` — all four base versions 0.1.0 → 0.1.1.
- `.circleci/config.yml` — pins of `circleci_kerghan-base` and `vite_kerghan-base`.
- `dockerfiles/kerghan_standalone/Dockerfile` — `vite_kerghan-base` pin and comment.
- `docs/agents/architecture/infra/ci-jobs.md`, `docs/agents/standalone/inner-stack.md`, `.claude/agents/infra.md` — quoted versions.
- Files updated by `scripts/bump_version.sh 0.10.1` (README.md, package.json files, `standalone/bin/kerghan`, `standalone/install.sh`, `dockerfiles/production_kerghan/Dockerfile`).

## CI Checks
- `.circleci/`: `docker-compose run --rm circleci config validate` (validates the config; the jobs themselves run in CI).
- `scripts/`: the bats suite in `scripts/test/` (CI job: `scripts_tests`), since `bump_version.sh` is run.

## Notes
- Releasing and tagging `0.10.1` on `main` is done by the user, and the post-release arm64 verification is manual (user).
- The tag pipeline rebuilds the bases (the change touches `dockerfiles/base/`), overwriting the manually published `0.1.1` tags with equivalent content.
- Risk: Node 22.21.1 → 22.23.4 patch bump; backend/frontend CI jobs will show any regression.
