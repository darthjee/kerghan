# Issue: Build base images

## Description

As part of the deployment process, Kerghan needs a CI step that builds and publishes the
project's Docker "base images" whenever their Dockerfile changes, so that dependent
dev/CI/production images can `FROM` a fresh, pre-baked dependency layer instead of reinstalling
dependencies on every build (see `aux/base-image.md` for the generic pattern this follows, based
on `majora-3`'s working implementation).

The 4 base images already exist as Dockerfiles and `version` entries (`kerghan-base`,
`circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`), and `bin/image.sh`
already has the build/push/skip-if-unchanged logic — what's missing is wiring a CircleCI
`release-image` job (multi-arch: amd64 + arm64) that actually invokes it on tag builds, plus a
`FORCE_IMAGE_BUILD` env var to force a build/publish the first time, since none of these 4 images
have ever actually been built/pushed despite the repo already having prior git tags.

## Problem

- The `release-image` CircleCI job described in `aux/base-image.md` doesn't exist yet in
  `.circleci/config.yml` — nothing currently builds or publishes `kerghan-base`,
  `circleci_kerghan-base`, `production_kerghan-base`, or `vite_kerghan-base` to Docker Hub.
- Because the repo already has prior git tags but none of these 4 images were ever actually
  published, `bin/image.sh`'s existing `skip_if_unchanged` guard (which diffs
  `dockerfiles/<image>/` against the previous tag) can't be relied on for the very first publish —
  a diff against the previous tag may look unchanged even though the image itself was never built.
- `bin/image.sh` has no manual override today to force a build/push regardless of the tag/diff
  guards.

## Expected Behavior

- On a tag build, CircleCI builds and pushes any of the 4 base images whose
  `dockerfiles/<image>/` subtree changed since the previous tag, for both `amd64` and `arm64` —
  and skips the ones that didn't change, same as `aux/base-image.md`'s `skip_if_unchanged`
  pattern.
- When `FORCE_IMAGE_BUILD` is set on a pipeline run, `bin/image.sh`'s `build`/`push`/`qemu`
  functions build and push unconditionally, bypassing both `skip_if_not_tag` and
  `skip_if_unchanged` — used manually for this first-ever publish, and as a general escape hatch
  afterward.
- Non-tag (branch) builds remain unaffected unless `FORCE_IMAGE_BUILD` is explicitly set.

## Solution

### Scope

- **Images in scope**: all 4 base images already declared in the root `version` file and
  `dockerfiles/`: `kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`,
  `vite_kerghan-base`. No new base images to create — Dockerfiles and `version` entries already
  exist (see `aux/base-image.md` for the generic pattern, `bin/image.sh` for the existing
  build/push/skip script).
- **Multi-arch**: build both `amd64` and `arm64` for every base image, mirroring majora-3's
  pattern (`aux/base-image.md` §5) — two `release-image` job instances per image (native +
  `arch: arm64`), QEMU setup via `setup_qemu`, `-arm64` tag suffix.
- Out of scope: the leaf app images (`kerghan`, `production_kerghan`, `vite_kerghan`) are not
  pushed to Docker Hub (decided in `kerghan.md` §6/§20 — local-build-only), so they don't need a
  `release-image` job.

### FORCE_IMAGE_BUILD

- **Bypass scope**: `FORCE_IMAGE_BUILD` bypasses *all* guards in `bin/image.sh` —
  `skip_if_not_tag` and `skip_if_unchanged` — for `build`, `push`, and `qemu`. When set, the
  image is built/pushed unconditionally, regardless of whether the current commit is a tag build
  or whether `dockerfiles/<image>/` changed since the previous tag.
- **Why it's needed now**: the repo already has previous git tags, but none of the 4 base images
  have ever actually been built/pushed. `skip_if_unchanged`'s existing "no previous tag → proceed"
  branch doesn't help here (a previous tag *does* exist), and a diff against it may look unchanged
  even though the image was never published. `FORCE_IMAGE_BUILD` is the manual escape hatch for
  this bootstrap case, and doubles as a durable override for any future forced rebuild (e.g. an
  upstream `darthjee/*` base image updated with no local Dockerfile change).
- **Where it's implemented**: verified against `darthjee/scripts:0.9.0`
  (`~/projetos/mine/docker/scripts/0.9.0/`) — that image only ships `builder/` (dependency-install
  helpers like `yarn_builder.sh`, `poetry_builder.sh`) and `sbin/` (dev-time utility scripts). It
  does **not** contain any build/push/skip-guard orchestration logic. That logic
  (`skip_if_not_tag`, `skip_if_unchanged`, `build`, `push`) is a per-project copy living directly
  in each repo's own `bin/image.sh` (confirmed by comparing kerghan's `bin/image.sh` against the
  near-identical but independent copy in `~/projetos/mine/docker/bin/image.sh`). So
  `FORCE_IMAGE_BUILD` is implemented directly in **kerghan's own `bin/image.sh`** — no shared
  `darthjee/scripts` image change and no separate `build-image-guard.md` needed.

### CircleCI wiring & secrets

- Add a parameterized `release-image` job to `.circleci/config.yml` (mirroring
  `aux/base-image.md` §4) and instantiate it twice per base image — native (amd64) and
  `arch: arm64` — for all 4 images in scope: 8 job instances total.
- **Out of scope for this issue**: switching the existing `backend_tests`, `backend_checks`,
  `jasmine`, `frontend-checks` jobs from `darthjee/circleci_node:0.2.1` to the new
  `darthjee/circleci_kerghan-base` (and adding `requires:` on the release job) — left as a
  follow-up issue once the base image is actually published and proven.
- **Secrets prerequisite**: per `aux/todo.md`, the CircleCI project doesn't yet have
  `DOCKER_ID_USER`, `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD` configured. This issue ships the
  `release-image` job and `bin/image.sh` changes regardless — `skip_if_not_tag` keeps it a no-op
  on branch builds — but note in the PR description that these 3 vars must be added under
  CircleCI Project Settings → Environment Variables before a tag build can actually push. Not a
  hard blocker on merging the code.

### Edge cases

- **Reusing an already-pushed version tag**: if `FORCE_IMAGE_BUILD` is used without bumping the
  image's entry in `version`, the push overwrites the existing `:<version>` (and `:latest`) tag on
  Docker Hub with new content. Accepted as-is for this bootstrap case — no version-bump enforcement
  in code. General convention going forward (documented, not enforced): bump `version` before
  forcing a rebuild of an image that's already been genuinely published.
- **Invocation scope**: `FORCE_IMAGE_BUILD` is *not* a persistent CircleCI project variable — it's
  set manually per pipeline run (CircleCI's "Trigger Pipeline" with custom parameters/env, or a
  scoped rerun) only when a forced rebuild is actually needed, so it doesn't silently disable
  `skip_if_unchanged` for every future release.
- **`qemu` step respects the same bypass**: `FORCE_IMAGE_BUILD` short-circuits `skip_if_not_tag`/
  `skip_if_unchanged` inside `setup_qemu` too, not just `build`/`push` — otherwise a forced push on
  a non-tag run would still skip QEMU setup and fail the arm64 build.
- **Partial multi-arch failure**: if the amd64 push succeeds but arm64 fails (or vice versa), no
  automatic rollback/cleanup — the job simply fails, leaving Docker Hub with a mismatched tag pair
  until the job is re-run. Acceptable; not handled specially.

## Benefits

- Dev, CI, and production images can `FROM` a pre-baked, versioned dependency layer instead of
  reinstalling dependencies on every build, matching the proven `majora-3` pattern.
- Base images only rebuild when their own Dockerfile subtree actually changes, keeping release
  time and Docker Hub churn low.
- `FORCE_IMAGE_BUILD` unblocks the first-ever publish of these 4 images without weakening the
  `skip_if_unchanged` guard for every future release.
