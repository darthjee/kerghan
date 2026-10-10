# Infra Plan: Release darthjee/kerghan to Docker Hub (multi-arch)

Main plan: [plan.md](plan.md)

## Overview
Publish the production backend image `darthjee/kerghan` to Docker Hub on every semver tag, as a
multi-arch manifest (amd64 + arm64) under `<CIRCLE_TAG>` and `latest`. Render's deploy wiring
(#341) and the standalone release (#343) are out of scope.

## Context
- `dockerfiles/production_kerghan/Dockerfile` is `FROM darthjee/production_kerghan-base:${BASE_VERSION}`
  (`ARG BASE_VERSION=latest`). That base image is **not** a manifest: amd64 is `:<ver>` / `:latest`,
  arm64 is `:<ver>-arm64` / `:latest-arm64` (`bin/image.sh` `build`/`push`).
- The `version` file pins `production_kerghan-base=0.1.0`. Base releases are skipped when
  `dockerfiles/base/` and `bin/image.sh` are unchanged, so the pinned tags always exist on Docker Hub.
- The existing release jobs run on `machine: true`, log in with `DOCKER_HUB_USERNAME` /
  `DOCKER_HUB_PASSWORD` and push under `DOCKER_ID_USER`. QEMU is set up with
  `docker run --privileged --rm tonistiigi/binfmt --install all`.
- Spec: `docs/agents/specs/standalone/images.md` (tags, versioning, multi-arch, job order).

## Steps

- [01 — Per-arch base stages in the production Dockerfile](infra/01-per-arch-base-stage.md)
- [02 — Release script for darthjee/kerghan](infra/02-release-script.md)
- [03 — `release-kerghan` CircleCI job](infra/03-circleci-job.md)
- [04 — Document the new job](infra/04-docs.md)

## CI Checks
- Production image still builds locally: `docker-compose build base_prod_build` (no CI job; the
  release job itself only runs on semver tags).
- CircleCI config validity: `circleci config validate` if the CLI is available through Docker
  (`docker run --rm -v "$PWD":/repo -w /repo circleci/circleci-cli:latest circleci config validate`);
  otherwise review the YAML carefully.

## Notes
- **TARGETARCH under the legacy builder:** BuildKit fills `TARGETARCH` automatically. Declare
  `ARG TARGETARCH=amd64` before the first `FROM` so a non-BuildKit build (e.g. an older
  `docker-compose build`) still resolves to `base-amd64`, the same image it pulls today. Verify that
  BuildKit's automatic value overrides that default (it does for the platform args, but check with
  `docker buildx build --platform linux/arm64 ...` printing the selected stage).
- **Render** still builds this Dockerfile until #341 lands. Render builds on amd64; with the default
  above, a missing `TARGETARCH` still picks `base-amd64`. Render does not pass `BASE_VERSION`, so it
  keeps using `latest`, as today.
- The `docker` buildx driver cannot push multi-platform images: create a `docker-container` builder
  (`docker buildx create --use`).
- `release-kerghan` is not required by anything yet. #341 makes `build-and-release` require it and
  #343 adds `release-kerghan-standalone` after it. Leave `build-and-release` untouched here.
- #343 will need the same multi-arch buildx flow for `darthjee/kerghan-standalone`. Keep the script
  small and readable. Do not generalize it now.
