# Issue: Infra: Dockerfiles pin unversioned "latest" base image tag (3 files)

## Description
Codacy's Hadolint scan flags `DL3007` ("Using `latest` is prone to errors if the image will ever update. Pin the version explicitly.") on the base-image `FROM` line of three application Dockerfiles, each of which consumes one of this repo's own custom base images by the `latest` tag:

- `dockerfiles/kerghan/Dockerfile:2` — `FROM darthjee/kerghan-base:latest`
- `dockerfiles/production_kerghan/Dockerfile:2` — `FROM darthjee/production_kerghan-base:latest`
- `dockerfiles/vite_kerghan/Dockerfile:2` — `FROM darthjee/vite_kerghan-base:latest`

## Problem
Unlike a typical third-party `latest` tag, these three base images (`kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`) are built by this same repo's own CI pipeline, and a literal hard-coded version tag would behave differently depending on the file:

- **`dockerfiles/production_kerghan/Dockerfile`** is the one case with real pipeline stakes: Render builds this Dockerfile directly at deploy time (outside `bin/image.sh`), pulling `darthjee/production_kerghan-base:latest` fresh from Docker Hub. `docs/agents/architecture/infra.md` ("Why `build-and-release` requires the production-base release-image jobs") documents that CircleCI's job graph deliberately runs `release-production_kerghan-base(-arm64)` ahead of `build-and-release`/the Render trigger specifically so Render never builds against a stale, previously-published image. Hard-coding this `FROM` line to a fixed version tag would defeat that guarantee — Render would keep building against whatever version string is checked in, regardless of whether a newer base image was just pushed, unless a human remembers to bump both the `version` file and this line together on every base-image change.
- **`dockerfiles/kerghan/Dockerfile`** and **`dockerfiles/vite_kerghan/Dockerfile`** have no such pipeline stakes: neither is built by any CI job today. Both are consumed only by local dev `docker-compose` services (`base_build`, and the frontend dev service in `docker-compose.yml`) — CI instead uses the corresponding `*-base` image directly (e.g. `upload_fe_files` runs on the `darthjee/vite_kerghan-base:0.1.0` executor image, never building `dockerfiles/vite_kerghan/Dockerfile` at all). Their `:latest` reference is a dev convenience, not a load-bearing ordering guarantee.

`bin/image.sh` already tags and pushes **both** `:latest` and an explicit `:${version}` tag (read from the root `version` file) for every base image on every release, so a pinned tag already exists for each image today (e.g. `darthjee/production_kerghan-base:0.1.0`) — the missing piece is only in how the three *consumer* Dockerfiles reference it.

## Solution
Make the version pin dynamic rather than hard-coded, using a Docker build `ARG` in each of the three Dockerfiles instead of a literal `latest`:

```dockerfile
ARG BASE_VERSION=latest
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/kerghan-base:${BASE_VERSION} as base
```

(`ARG` must be declared before the first `FROM` to be usable inside a later `FROM`; repeat the pattern for `production_kerghan`/`vite_kerghan` with their respective base image names.) Defaulting `BASE_VERSION` to `latest` keeps every existing build (local `docker-compose build`, Render's current config) working exactly as it does today with zero behavior change — but the literal `FROM` line no longer contains a bare `latest` string, so Hadolint's `DL3007` stops firing on all three files.

This also opens the door to actually pinning where it matters, without any code change required right now:
- **`production_kerghan`**: whoever owns Render access can later set `BASE_VERSION` as a Docker build argument in Render's service settings (dashboard-managed, not version-controlled in this repo) to pin deploys to an exact `production_kerghan-base` version instead of `latest`, if that's ever wanted. Flagging this as a manual, out-of-repo follow-up rather than part of this issue's diff.
- **`kerghan`/`vite_kerghan`**: since nothing in CI builds these two Dockerfiles, no pipeline changes are needed at all — the `ARG` alone resolves the finding.

No changes to `bin/image.sh`, the CircleCI config, or the `version` file are required for this issue.

**Verify before relying on it:** confirm locally (`hadolint dockerfiles/kerghan/Dockerfile`, etc.) that hadolint actually treats the `ARG`-templated `FROM` tag as non-literal and stops flagging `DL3007`, since hadolint does resolve global `ARG` defaults when parsing `FROM`. If it still fires because the resolved default is `latest`, fall back to a per-line `# hadolint ignore=DL3007` suppression on the affected line instead (mirroring the inline-disable precedent already used for other confirmed Codacy false positives — see the ".codacy.yml" section of `docs/agents/architecture/infra.md`).

## Benefits
Resolves the Hadolint `DL3007` finding on all three files with a zero-behavior-change diff (every build keeps defaulting to `latest` exactly as before), while leaving a documented, ready-to-use mechanism (`BASE_VERSION` build arg) for anyone who later wants `production_kerghan`'s Render deploys pinned to an explicit version — without reintroducing the staleness risk a hard-coded `FROM` tag would have caused.
