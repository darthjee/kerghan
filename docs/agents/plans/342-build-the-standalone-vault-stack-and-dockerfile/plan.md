# Plan: Build the standalone Vault stack and Dockerfile

Issue: [342-build-the-standalone-vault-stack-and-dockerfile.md](../../issues/342-build-the-standalone-vault-stack-and-dockerfile.md)

## Overview

Add the Vault-based standalone distribution: an inner compose stack (`mysql`, `kerghan`, stock
`tent`) under `standalone/vault/`, a Tent standalone configuration, and
`dockerfiles/kerghan_standalone/Dockerfile` with `standalone` and `standalone-offline` targets
that build the Vite frontend in a stage and write `/vault/.env` (`TENT_IMAGE`,
`KERGHAN_VERSION`). A smoke-test script, run through new `make` targets, builds the image, boots
it with `--privileged` and checks `/health.json` and `/` through Tent on port 80, plus a
restart with the data volume kept. CI jobs, release and offline tarballs stay in #343.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Smoke script** (owned by `standalone`): `standalone/scripts/smoke_test.sh`, executable,
  run from the repo root. Inputs, all optional env vars:
  - `IMAGE` (default `darthjee/kerghan-standalone:dev`) — the tag to test;
  - `KERGHAN_VERSION` (default `latest`) — passed as a build arg;
  - `SMOKE_PORT` (default `3080`) — host port mapped to Vault port 80;
  - `SKIP_BUILD` (`true` to test an already-built `IMAGE`).
  Exits `0` on success, non-zero with a message on failure, and always removes its container and
  data volume.
- **Build command** (used by the script and by the `make` target):
  `docker build -f dockerfiles/kerghan_standalone/Dockerfile --target standalone --build-arg KERGHAN_VERSION=<v> -t <IMAGE> .`
  (build context: repo root; BuildKit required for `TARGETARCH`/`BUILDPLATFORM` and the
  per-Dockerfile ignore file).
- **Make targets** (owned by `infra`, in the root `Makefile`):
  - `build-standalone` — runs the build command above with `STANDALONE_IMAGE?=darthjee/kerghan-standalone:dev`
    and `KERGHAN_VERSION?=latest`;
  - `standalone-smoke` — runs `IMAGE=$(STANDALONE_IMAGE) KERGHAN_VERSION=$(KERGHAN_VERSION) standalone/scripts/smoke_test.sh`.
