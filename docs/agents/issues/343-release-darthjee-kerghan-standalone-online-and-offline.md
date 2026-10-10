# Issue: Release darthjee/kerghan-standalone (online and offline)

## Description

Part of epic #336. Publish the standalone image `darthjee/kerghan-standalone` to Docker Hub in two variants: online, which pulls the inner images on first start, and offline, which ships with the inner images preloaded. Both are multi-arch (amd64 and arm64).

Depends on #342 (standalone stack and Dockerfile, already merged) and #340 (`darthjee/kerghan` multi-arch release).

## Problem

The standalone image can be built locally, but nothing publishes it. The offline target also cannot be built as multi-arch yet: `dockerfiles/kerghan_standalone/Dockerfile` copies `standalone/images/` as is, so a single buildx build gives the same tarballs to both architectures.

## Expected Behavior

- On every semver tag, after `release-kerghan` has pushed `darthjee/kerghan:<v>`, CI pushes four multi-arch (linux/amd64 + linux/arm64) tags:
  - `darthjee/kerghan-standalone:<v>` and `:latest`: target `standalone`;
  - `darthjee/kerghan-standalone:<v>-offline` and `:latest-offline`: target `standalone-offline`.
- Version: the app semver tag. `kerghan-standalone:<v>` always bakes in `kerghan:<v>` (`KERGHAN_VERSION=<v>`).
- For each architecture, the offline image contains the `docker save` tarballs of the inner images for that architecture:
  - `darthjee/kerghan:<v>`;
  - `mysql:9.3.0`;
  - the matching Tent tag: `darthjee/tent:1.0.3` for amd64, `darthjee/tent:1.0.3-arm64` for arm64.
- The offline variant starts with no network access (`--pull never`) on both architectures.

## Solution

- **Dockerfile (standalone agent):** the `standalone-offline` stage copies per-architecture tarballs, `COPY standalone/images/${TARGETARCH}/ /vault/images/`. Update the comment above the stage to match.
- **Release script (infra):** add `bin/release_kerghan_standalone.sh`, modeled on `bin/release_kerghan.sh` (require `CIRCLE_TAG`, binfmt + buildx builder, Docker Hub login). It:
  1. pulls each inner image per platform (`--platform linux/amd64` / `linux/arm64`) and `docker save`s it into `standalone/images/amd64/*.tar` and `standalone/images/arm64/*.tar`;
  2. runs `docker buildx build --platform linux/amd64,linux/arm64 --build-arg KERGHAN_VERSION=$CIRCLE_TAG` for the `standalone` target (tags `<v>`, `latest`) and the `standalone-offline` target (tags `<v>-offline`, `latest-offline`), with `--push`;
  3. inspects the pushed manifests with `docker buildx imagetools inspect`.
- **CircleCI (infra):** add a `release-kerghan-standalone` job (machine executor) that runs on tags only (`*tags_only`) and requires `release-kerghan`.
- **Smoke test (infra):** after the push, the same job (or a follow-up amd64 job) runs `standalone/scripts/smoke_test.sh` against `darthjee/kerghan-standalone:<v>-offline` with inner-image pulls disabled, to show the offline image boots with no network. arm64 is checked by hand. There is no CI job on arm64.
- **Docs:** update `docs/agents/architecture/infra.md` (new job, script, tags), and the standalone specs if they describe the images layout.

**Owners:** infra (script, CircleCI, smoke-test wiring, infra docs); standalone (Dockerfile per-arch `COPY`).

## Benefits

- Users can run the whole Kerghan stack from a single published image, on amd64 or arm64.
- The offline variant works in air-gapped or restricted-network environments.
- Every app release gets a matching standalone image automatically.
