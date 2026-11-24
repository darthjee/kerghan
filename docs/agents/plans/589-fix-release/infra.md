# Infra Plan: Fix release

Main plan: [plan.md](plan.md)

## Overview

`release-kerghan-standalone` fails with `darthjee/kerghan:<tag> is amd64, expected arm64.` even though the published images are correct. The CI host's Docker now uses the containerd image store. There, `docker pull --platform linux/arm64 <tag>` adds arm64 to the local multi-platform image instead of replacing it, and `docker image inspect` (no `--platform`) reports the host's amd64. `docker save` would also export both platforms into each per-arch tarball.

Fix `save_image` so it pulls `<repo>@<linux/arch digest>` and re-tags it. The local image is then single-platform on either store, so the existing architecture check and `docker save` behave correctly again.

## Context

- Script: `bin/release_kerghan_standalone.sh`. `save_images` loops over `ARCHES="amd64 arm64"` and calls `save_image <arch> <image> <name>` for `darthjee/kerghan:<version>`, `mysql:8.4.11`, `mysql:9.3.0` and `$(tent_image_for <arch>)` (`darthjee/tent:1.0.3`, or `darthjee/tent:1.0.3-arm64` for arm64).
- Registry shapes, verified with `docker buildx imagetools inspect`:
  - `darthjee/kerghan:<tag>`: OCI index, `linux/amd64` + `linux/arm64`.
  - `mysql:*`: OCI index, `linux/amd64`, `linux/arm64` with variant `v8`, plus `unknown/unknown` attestation manifests.
  - `darthjee/tent:1.0.3` and `darthjee/tent:1.0.3-arm64`: **single-platform** `manifest.v2` (amd64 and arm64 respectively). These are not indexes.
- Plain `--format` Go templates are unreliable here. `{{range .Manifest.Manifests}}` errors out on single-platform manifests, and field access like `{{.Manifest.MediaType}}` silently falls back to the default text output. `--format '{{json .Manifest}}'` plus `jq` works for all shapes (checked locally):

  ```bash
  docker buildx imagetools inspect "$image" --format '{{json .Manifest}}' \
    | jq -r --arg a "$arch" '
        if .manifests
        then [.manifests[] | select(.platform.os == "linux" and .platform.architecture == $a) | .digest]
        else [.digest]
        end | .[]'
  ```

- `jq` is preinstalled on CircleCI's `ubuntu-2204` machine images, and the `scripts_tests` images (CI `apk add jq`; local `dockerfiles/scripts_tests`) already have it.
- Out of scope: the #580 changes (base images, `darthjee/node` 0.3.0, scripts 0.15.0) stay as they are. The 0.10.1 tag is not re-run; 0.10.2 is cut after merge as the end-to-end check.

## Steps

- [01 — Pull per-arch images by digest in save_image](infra/01-pull-by-digest.md)
- [02 — Bats coverage for save_image](infra/02-bats-save-image.md)
- [03 — Update infra and standalone docs](infra/03-docs.md)

## CI Checks

- `scripts/test` (now including the new `release_kerghan_standalone` tests): `docker-compose run --rm scripts_tests` (CI job: `scripts_tests`)
- `bin/release_kerghan_standalone.sh` itself only runs on tag builds (`release-kerghan-standalone`); the 0.10.2 release is its end-to-end check.

## Notes

- Never run `bats`, `jq` pipelines over project files, or other tooling on the host for the tests; use `docker-compose run --rm scripts_tests` (per CLAUDE.md).
- `docker tag <repo>@<digest> <repo>:<tag>` re-points the tag at the single-platform manifest on the containerd store. The loop saves before moving to the next architecture, so this is safe.
- `docker save` from the containerd store writes an OCI layout that also has the legacy `manifest.json`, so the offline image's inner daemon can `docker load` it. The existing amd64 offline smoke test (`standalone/scripts/smoke_test.sh`, inner `docker image inspect` by name) covers this.
- `${image%:*}` is enough to split `repo:tag` for every image used. Note the assumption (no registry host with a port) in a comment.
