# Infra — Releases

Release jobs, deploys and image base selection. Part of the [infra architecture hub](../infra.md).

## `release-kerghan` — the production image on Docker Hub

`release-kerghan` (#340) runs `bin/release_kerghan.sh release` on semver tags. The script fails if
`CIRCLE_TAG` is empty, reads `production_kerghan-base=<ver>` from the `version` file, sets up QEMU
and a `docker-container` buildx builder (the default `docker` driver cannot push multi-platform
images), logs in with `DOCKER_HUB_USERNAME`/`DOCKER_HUB_PASSWORD`, and runs one
`docker buildx build --platform linux/amd64,linux/arm64 --build-arg BASE_VERSION=<ver> --push`
tagged `$DOCKER_ID_USER/kerghan:<CIRCLE_TAG>` and `:latest`. It then prints
`docker buildx imagetools inspect` so the log shows both platforms. There is no skip-if-unchanged
guard: every release tag publishes the image.

Unlike the `*-base` images, `darthjee/kerghan` is a **multi-arch manifest**: one tag serves both
amd64 and arm64, with no `-arm64` suffix. It is versioned by the **git tag**, not by the `version`
file (the `version` file only pins its base image).

It requires the five test/lint jobs and `release-production_kerghan-base(-arm64)`, so the pinned
base tags exist before the build. `release-kerghan-standalone` (#343) requires it, because the
standalone image bundles `darthjee/kerghan:<tag>`. `build-and-release` requires it too, because
Render's thin Dockerfile is `FROM` that tag (#341, #362).

## Render deploy

The Render `kerghan` service is Git-backed: it builds `./dockerfiles/production_kerghan/Dockerfile`
(context `.`) from its configured branch. That Dockerfile is thin (#362) — a comment and the single
line `FROM darthjee/kerghan:<version>` — so production runs exactly the image `release-kerghan`
published, and `ENTRYPOINT` (migrations, see "Migrations on production boot") is inherited.
`scripts/bump_version.sh` rewrites that `FROM` tag along with the other release pins. Render never
runs the standalone (Vault) image.

On a semver tag, `build-and-release` runs `scripts/deploy.sh deploy`, which:

1. skips the deploy unless HEAD is the latest tag (`checkLastVersion`);
2. checks that the thin Dockerfile's `FROM darthjee/kerghan:<x>` tag equals `CIRCLE_TAG`, failing
   (before any Render API call) on an empty tag, a missing `FROM` line or a mismatch
   (`dockerfile version mismatch: ... (run scripts/bump_version.sh)`);
3. looks up the service id by `RENDER_SERVICE_NAME` (default `kerghan`);
4. moves the service branch to the tag (`PATCH /v1/services/{id}` with `{"branch": "<CIRCLE_TAG>"}`);
5. triggers a deploy (`POST /v1/services/{id}/deploys`, no body); the deploy fails if either
   request is rejected or the POST returns no deploy id;
6. polls `watch_deployment` on that deploy id until it is `live`, exiting non-zero on
   `build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`, `deactivated`, or a timeout.

The branch PATCH may itself trigger an auto-deploy; CI watches the deploy id returned by its own
POST, so that is harmless. There is no rollback command. No Render dashboard change is needed: the
service id, Dockerfile path and `kerghan.onrender.com` hostname stay the same. The production
database is external to the service, so no data moves.

## `release-kerghan-standalone` — the standalone image on Docker Hub

`release-kerghan-standalone` (#343) runs `bin/release_kerghan_standalone.sh release` on semver
tags, after `release-kerghan`. What the image contains is described in
[../standalone.md](../../standalone.md). It uses the same Docker Hub env vars (`DOCKER_ID_USER`,
`DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`) and the same QEMU + `docker-container` buildx setup.
It publishes four tags of `$DOCKER_ID_USER/kerghan-standalone`, all multi-arch manifests
(amd64 + arm64):

| Tag | Dockerfile target | Contents |
|-----|-------------------|----------|
| `<tag>` | `standalone` | Online: pulls the inner images on first boot |
| `<tag>-offline` | `standalone-offline` | Offline: inner images preloaded from tarballs |
| `latest` | — | Points at `<tag>` |
| `latest-offline` | — | Points at `<tag>-offline` |

Both targets come from `dockerfiles/kerghan_standalone/Dockerfile`, built with
`KERGHAN_VERSION=<tag>`. The script runs in this order:

1. **Save the inner images.** For each architecture (amd64, then arm64) it clears
   `standalone/images/<arch>/`, then pulls each image by its `linux/<arch>` manifest digest and
   `docker save`s
   `darthjee/kerghan:<tag>`, `mysql:8.4.11`, `darthjee/tent` (see [Tent version](#tent-version))
   and, for the #469 migration only, `mysql:9.3.0`, plus the log collector image
   `docker:27.5.1-cli` (it must match `LOGS_IMAGE` in the Dockerfile's `.env` step), as
   `kerghan.tar`, `mysql.tar`, `tent.tar`, `mysql-legacy.tar` and `docker-cli.tar`. The digest comes from
   `docker buildx imagetools inspect` (the matching entry of the index, or the manifest's own digest
   for a single-platform image). The pulled `repo@digest` is re-tagged to `repo:tag`,
   checked with `docker image inspect` (the job fails if the architecture does not match) and
   saved. Pulling by digest is needed because the containerd image store keeps multi-platform
   images under one tag: a pull by tag with `--platform` adds to the local image, and an inspect
   then reports the host architecture (amd64). Each architecture is saved before the next one is
   pulled. The job logs `docker version` and the storage driver so the image store in use shows in
   the CI log. (#580's diagnosis of amd64 base images was not the cause of this symptom, #589.) The
   offline stage copies
   `standalone/images/${TARGETARCH:-amd64}/`, so each platform gets its own tarballs. The folder is
   git-ignored.
2. **Build and push** `<tag>` and `<tag>-offline`. The offline build reuses the cached frontend and
   online layers.
3. **Smoke test** the published offline image on the amd64 machine, with `SKIP_BUILD=true` and
   `SMOKE_EXPECT_OFFLINE=true` (`standalone/scripts/smoke_test.sh`). The arm64 image is checked by
   hand.
4. **Promote** `latest` and `latest-offline` with `docker buildx imagetools create`, then
   `imagetools inspect` all four tags so the log shows both platforms.

The versioned tags are pushed before the smoke test, because a multi-arch manifest must be
pushed before it can be pulled. If the smoke test fails, `<tag>` and `<tag>-offline` stay
published and `latest` / `latest-offline` are not moved.

### Tent version

The `tent=<X.Y.Z>` line of the root `version` file is the single source of truth for both
`darthjee/tent` and `darthjee/tent-test`. The release script and the standalone Dockerfile read it
directly, so neither holds a literal Tent version.

Tent is published as one multi-arch tag for amd64 and arm64: the release saves that same tag once
per architecture, each time from that platform's digest. An empty or missing `tent=` entry stops
the release before any Docker command. Before each Tent save, `require_platform_manifest` fails
the release, naming the image and the architecture, when the tag has no `linux/<arch>` manifest or
is a single-platform tag. A tag that cannot be inspected at all fails with the inspect error
instead.

CircleCI executor images, `docker-compose.yml` and some docs cannot read a file, so they hold
copies of the version, owned by [`scripts/bump_tent.sh`](ci-setup.md#tent-pin). The
`upload_proxy_files` job copies the Tent runtime out of its own job image to the production host,
so a bump also reaches the live proxy on the next release tag.

## `release-kerghan-assets` — client assets on the GitHub release

`release-kerghan-assets` runs `bin/release_kerghan_assets.sh release` on semver tags, after
`release-kerghan-standalone`, so the image the client pins is already published when the client
ships. It runs on `cimg/base:stable` and installs `gh` from the pinned release tarball
(`GH_VERSION`), checked against `GH_SHA256` before it is extracted. `gh` authenticates with the
`GITHUB_TOKEN` project variable (see `docs/agents/environment-variables.md`).

The script:

1. Fails when `CIRCLE_TAG` or `GITHUB_TOKEN` is empty, and when `standalone/bin/kerghan` or
   `standalone/install.sh` does not pin `KERGHAN_VERSION="<tag>"` (both are stamped by
   `scripts/bump_version.sh`), so a release never ships a client that runs another image version.
2. Stages the assets and writes `SHA256SUMS` (bare basenames, checked right away):

   | Asset | Source |
   |-------|--------|
   | `kerghan` | `standalone/bin/kerghan`, pinned to the tag's image |
   | `install.sh` | `standalone/install.sh` |
   | `config.example` | `standalone/config.example` |
   | `SHA256SUMS` | SHA-256 of the three files above |

3. Creates the GitHub release of the tag when it does not exist yet (`gh release create
   --verify-tag`; a release created concurrently is fine).
4. Uploads the assets with `gh release upload --clobber`, so a rerun replaces them.

The installer one-liner downloads `install.sh` from `releases/latest/download/`, which then
downloads `kerghan` from the same release. How users verify the assets with `SHA256SUMS`, and
what the images contain, is in [../standalone.md](../../standalone.md).

## Production Dockerfile base selection

`darthjee/production_kerghan-base` uses a different tag per architecture (`:<ver>` for amd64,
`:<ver>-arm64` for arm64), so `dockerfiles/release_kerghan/Dockerfile` declares one stage per
architecture (`base-amd64`, `base-arm64`) and selects `FROM base-${TARGETARCH:-amd64} as base`.
BuildKit fills `TARGETARCH` from the target platform and only pulls the stage it needs. The global
`ARG TARGETARCH` deliberately has **no default**: a default would override BuildKit's automatic
value (an arm64 build would silently pick `base-amd64`). The legacy builder leaves it empty, so the
`:-amd64` fallback keeps it on the amd64 base. `BASE_VERSION` defaults to `latest`; only
`release-kerghan` pins it. Note that a local `docker-compose build base_prod_build` on an arm64
host now builds from `production_kerghan-base:latest-arm64`.

## Shared base Dockerfile

All four `*-base` images are built by `bin/image.sh` from the single
`dockerfiles/base/Dockerfile`, selecting the image with `docker build --target <image>`. The
per-image differences (base image, user, home/app/source directories, yarn cache path, rsync pin,
and the user running `yarn_builder.sh`) are build args set per image in the `build_args` function
of `bin/image.sh`; the only per-image content left in the Dockerfile is each target's exec-form
`CMD`. Consequences:

- Since the arg sets live in `bin/image.sh`, `skip_if_unchanged` diffs both `dockerfiles/base/` and
  `bin/image.sh`: a change to either rebuilds all four images on the next tag (`FORCE_IMAGE_BUILD`
  still bypasses the guard).
- The version pins live in one place, as `ARG` defaults at the top of `dockerfiles/base/Dockerfile`:
  `SCRIPTS_IMAGE` (`darthjee/scripts`) and `NODE_IMAGE_VERSION` (used for both `darthjee/node` and
  `darthjee/circleci_node`), so a bump is a one-line edit. The `darthjee/scripts` pin (0.15.0) in the leaf
  Dockerfiles is separate and not covered by this.
- `BUILDER_USER` is `root` for `kerghan-base`, `vite_kerghan-base` and `circleci_kerghan-base`: `yarn_builder.sh` has to be
  able to write to the root-owned global yarn cache in the node images, otherwise it finds no new
  packages and the pre-warmed cache ends up empty. `production_kerghan-base`
  keeps running it as its own user. (`circleci_node` 0.3.0 gives its non-root user a yarn cache at
  `~/.cache/yarn/v6`, so only root hits the global path the script copies from.)

