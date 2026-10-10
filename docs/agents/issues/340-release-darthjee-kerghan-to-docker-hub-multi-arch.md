# Issue: Release darthjee/kerghan to Docker Hub (multi-arch)

## Description

Part of epic #336. Publish the production backend image to Docker Hub as `darthjee/kerghan`. Render
will deploy it (#341) instead of building it, and the standalone stack will bake it in (#343). The
target behaviour is specified in `docs/agents/specs/standalone/images.md`.

## Problem

`darthjee/kerghan` (built from `dockerfiles/production_kerghan/Dockerfile`, renamed in #339) is a
local tag only. Nothing publishes it, so neither Render nor the standalone image can consume it.

The image is `FROM darthjee/production_kerghan-base`, which is **not** a multi-arch manifest: amd64
is `:<ver>` / `:latest`, arm64 is `:<ver>-arm64` / `:latest-arm64`. So a multi-arch build of
`darthjee/kerghan` must pick a different base tag per architecture.

## Expected Behavior

- On every semver tag push (`\d+\.\d+\.\d+`), after the tests pass, CI pushes
  `darthjee/kerghan:<CIRCLE_TAG>` and `darthjee/kerghan:latest`.
- Both tags are multi-arch manifests (amd64 + arm64), unlike the `-arm64` suffix convention of the
  `*-base` images, which stays as is.
- Version is the git tag (`CIRCLE_TAG`), **not** the `version` file (which keeps tracking only the
  `*-base` images).
- No "skip if unchanged" guard: it is rebuilt and pushed on every semver tag.
- The image still runs migrations on boot and serves the API (existing entrypoint unchanged).

## Solution

- New CircleCI job `release-kerghan`, tag-only (`tags_only` filters), that builds
  `dockerfiles/production_kerghan/Dockerfile` for amd64 and arm64 and pushes one multi-arch
  manifest under `<CIRCLE_TAG>` and `latest`.
- `requires:` the same test jobs as `build-and-release` (`backend_tests`, `backend_checks`,
  `jasmine`, `frontend-checks`, `proxy_extension_tests`) plus `release-production_kerghan-base`
  and `release-production_kerghan-base-arm64`.
- **Per-arch base stage:** `dockerfiles/production_kerghan/Dockerfile` declares
  `FROM darthjee/production_kerghan-base:${BASE_VERSION} AS base-amd64` and
  `FROM darthjee/production_kerghan-base:${BASE_VERSION}-arm64 AS base-arm64`, and selects
  `base-${TARGETARCH}`. The job then runs a single
  `docker buildx build --platform linux/amd64,linux/arm64 --push` (QEMU on `machine: true`), so
  only `<v>` and `latest` end up on Docker Hub — no arch-suffixed tags.
- **Base pin:** the job passes `BASE_VERSION` from the `version` file
  (`production_kerghan-base=<ver>`, so `:0.1.0` / `:0.1.0-arm64` today), not `latest`. The
  pinned base tags always exist, since base releases are skipped only when unchanged.
- The Dockerfile change must keep working for the local `base_prod_build` compose service and for
  Render, which still builds this Dockerfile until #341 lands (both use BuildKit, which sets
  `TARGETARCH`).
- Uses the existing Docker Hub credentials (`DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`,
  `DOCKER_ID_USER`).
- Update `docs/agents/architecture/infra.md` (and `.claude/agents/infra.md` if it lists release
  jobs) with the new job and its place in the workflow.

### Out of scope

- Rewiring `build-and-release` to require `release-kerghan` and deploy by image: #341.
- The standalone release that requires `release-kerghan`: #343.

## Acceptance criteria

- On a semver tag, `darthjee/kerghan:<tag>` and `:latest` exist on Docker Hub and
  `docker manifest inspect` shows amd64 and arm64 for each.
- `docker pull darthjee/kerghan:<tag>` works on both amd64 and arm64.
- The image still runs migrations on boot and serves the API.
- Non-tag builds do not run the job.

## Depends on

#339 (rename image tags) — merged.

**Owner:** infra
