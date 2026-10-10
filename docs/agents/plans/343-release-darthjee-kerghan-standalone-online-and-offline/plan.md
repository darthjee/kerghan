# Plan: Release darthjee/kerghan-standalone (online and offline)

Issue: [343-release-darthjee-kerghan-standalone-online-and-offline.md](../../issues/343-release-darthjee-kerghan-standalone-online-and-offline.md)

## Overview

Add a tag-only `release-kerghan-standalone` CircleCI job, after `release-kerghan`. It runs a new
`bin/release_kerghan_standalone.sh` that:

1. saves each architecture's inner images to `standalone/images/<arch>/`;
2. builds and pushes the `standalone` and `standalone-offline` targets as multi-arch manifests
   (`<v>`, `<v>-offline`);
3. smoke-tests the offline image on amd64;
4. only then points `latest` / `latest-offline` at the new tags.

The standalone agent makes the offline Dockerfile stage copy the tarball folder that matches
`TARGETARCH`, and adds an offline assertion to the smoke test.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Tarball layout (build context):** `standalone/images/amd64/*.tar` and
  `standalone/images/arm64/*.tar`, still git-ignored by the existing `standalone/images/` entry.
  - The release script writes three files per architecture: `kerghan.tar` (`darthjee/kerghan:<v>`),
    `mysql.tar` (`mysql:9.3.0`) and `tent.tar`.
  - `tent.tar` holds `darthjee/tent:1.0.3` for amd64 and `darthjee/tent:1.0.3-arm64` for arm64.
  - Each tarball holds the image for that folder's architecture.
- **Dockerfile:** the `standalone-offline` stage copies
  `standalone/images/${TARGETARCH:-amd64}/` into `/vault/images/`. The `:-amd64` fallback matches
  the legacy-builder behavior of the `standalone` stage. The build args are unchanged:
  `KERGHAN_VERSION=<v>`, targets `standalone` / `standalone-offline`.
- **Smoke test offline mode:** `standalone/scripts/smoke_test.sh` accepts a new optional
  `SMOKE_EXPECT_OFFLINE=true`. When it is set, the script also asserts:
  - the container's `COMPOSE_UP_ARGS` contains `--pull never`;
  - the inner daemon has `darthjee/kerghan:<KERGHAN_VERSION>`, `mysql:9.3.0` and the `TENT_IMAGE`
    from `/vault/.env`.
- **Infra invocation:** the release script calls the smoke test with:
  - `IMAGE=$DOCKER_ID_USER/kerghan-standalone:<v>-offline`
  - `SKIP_BUILD=true`
  - `KERGHAN_VERSION=<v>`
  - `SMOKE_EXPECT_OFFLINE=true`
