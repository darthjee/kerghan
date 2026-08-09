# Issue: use base image in tests and development

## Description
Switch the backend CI jobs (`backend_tests`, `backend_checks`) in `.circleci/config.yml` to run
against the `circleci_kerghan-base` image published in #7/#8, instead of the generic
`darthjee/circleci_node:0.2.1` image they use today.

## Problem
#7/#8 built and published 4 multi-arch base images to Docker Hub (`kerghan-base`,
`circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`) via the `release-image`
CI job, each pre-warming its package manager's dependency cache. Despite that,
`backend_tests`/`backend_checks`/`jasmine`/`frontend-checks` still all run on the generic
`darthjee/circleci_node:0.2.1` image and do a full `yarn install` from a cold cache every run —
`.claude/agents/infra.md`'s own "Backend image publishing" section already flags this gap as a
known follow-up, not done yet.

## Expected Behavior
- `backend_tests` and `backend_checks` run against `darthjee/circleci_kerghan-base:0.1.0` (a
  pinned version read from the root `version` file, not `:latest`).
- Both jobs still run `yarn install`, but it completes fast because it reads from the base
  image's pre-warmed Yarn cache instead of hitting the network.
- Both jobs wait on `requires: [release-circleci_kerghan-base, release-circleci_kerghan-base-arm64]`.
- `jasmine`/`frontend-checks` are unchanged — they intentionally stay on the generic
  `circleci_node` image, since there is no frontend-specific CI base image.
- No Dockerfile changes — `dockerfiles/kerghan/Dockerfile`, `dockerfiles/vite_kerghan/Dockerfile`,
  and `dockerfiles/production_kerghan/Dockerfile` already build `FROM` their respective
  `*-base` images.

## Solution
Checked the reference project's own real (already-working, not aspirational) CircleCI config
for the pattern to mirror: its backend test/lint jobs pin a specific
`circleci_<project>-base:<version>` tag as their `docker:` executor image, keep the
dependency-install step (fast, cache-warmed), and `requires:` the matching `release-image` job.
Frontend jobs (`jasmine`/`frontend-checks`) stay on the generic `circleci_node` image there too,
since no frontend CI base image exists.

Applying that to Kerghan:

- Change `backend_tests`/`backend_checks`'s `docker:` image from `darthjee/circleci_node:0.2.1`
  to `darthjee/circleci_kerghan-base:0.1.0`.
- Add `requires: [release-circleci_kerghan-base, release-circleci_kerghan-base-arm64]` to both
  jobs. That release job already runs on every push (branch or tag) via
  `filters: { tags: { only: /.*/ } }`, but `bin/image.sh`'s `skip_if_not_tag` makes it a true
  no-op on non-tag builds (it exits before even checking for changes) — so this `requires:`
  doesn't slow down branch CI, it just sequences things.
- Leave `jasmine`/`frontend-checks` untouched.
- No Dockerfile changes needed — the leaf Dockerfiles already extend the base images.

**Bootstrap gap:** no git tag has ever been cut in this repo, and `release-image` only pushes to
Docker Hub on tag builds — so `circleci_kerghan-base:0.1.0` has never actually been published.
Pointing CI at it today would break with an image-pull failure. This is not this issue's
implementation concern: the repo owner will manually trigger a `FORCE_IMAGE_BUILD=1` CircleCI
run to seed the `*-base` images on Docker Hub before/alongside merging this change.

**Alternatives considered:**
- `:latest` vs. pinned version — pinned won, matching the reference project and avoiding a bad
  `:latest` push breaking every subsequent CI run.
- Publishing base images on every branch build (not just tags), to sidestep the bootstrap gap —
  rejected, since it would raise Docker Hub push volume and risk an unreleased branch
  overwriting the pinned `:0.1.0` tag before an official release. Confirmed `release-image` is a
  true no-op on branch builds today (not "build ahead"), so this is a genuine behavior change,
  not just documentation.

## Benefits
- Backend CI jobs get faster (Yarn reads from a pre-warmed cache instead of a cold network
  install).
- Closes the gap `.claude/agents/infra.md` already flagged as a known follow-up from #7/#8.
- Matches the reference project's proven CI pattern, keeping Kerghan's pipeline consistent with
  precedent rather than inventing a new shape.
