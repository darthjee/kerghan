# Plan: use base image in tests and development

Issue: [9-use-base-image-in-tests-and-development.md](../../issues/9-use-base-image-in-tests-and-development.md)

## Overview

Switch the `backend_tests`/`backend_checks` CircleCI jobs from the generic
`darthjee/circleci_node:0.2.1` image to the pinned `darthjee/circleci_kerghan-base:0.1.0` image
published by `#7`/`#8`, and sequence them after that image's release job via `requires:`. This
is a single, self-contained change to `.circleci/config.yml` — no other files in the repo need
code changes.

## Context

`#7`/`#8` built and published 4 multi-arch base images to Docker Hub (`kerghan-base`,
`circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`), each pre-warming its
package manager's dependency cache. Despite that, `backend_tests`/`backend_checks` still run on
the generic `darthjee/circleci_node:0.2.1` image and do a full `yarn install` from a cold cache
every run. `.claude/agents/infra.md`'s own "Backend image publishing" section (written in `#8`)
already flags this exact gap as a known follow-up, not done yet.

The reference project's own real, working CircleCI config was checked during issue refinement
for the pattern to mirror: backend test/lint jobs pin a specific `circleci_<project>-base:<version>`
tag as their `docker:` executor image, keep the dependency-install step (now fast — reads from
the pre-warmed cache instead of network), and `requires:` the matching `release-image` job.
Frontend jobs stay on the generic `circleci_node` image there too, since no frontend-specific CI
base image exists — matching Kerghan's own `circleci_kerghan-base`, which is built from
`backend/package.json`/`yarn.lock` only.

Traced `bin/image.sh`'s `push()`: `skip_if_not_tag` hard-exits the whole script on any non-tag
build, before `skip_if_unchanged` is even reached — so `release-image` is a true no-op on branch
pushes today, not a "build ahead" mechanism. This is why the `requires:` addition doesn't slow
down branch CI: on non-tag builds, `release-circleci_kerghan-base`/`-arm64` complete almost
instantly (no real build/push), satisfying the dependency quickly; on tag builds, they do the
real work and `backend_tests`/`backend_checks` correctly wait for the freshly-published image.

**Known pre-existing gap, explicitly out of scope for this issue:** no git tag has ever been cut
in this repo, so `circleci_kerghan-base:0.1.0` has never actually been pushed to Docker Hub yet.
The repo owner will manually seed it (and the other `*-base` images) via a `FORCE_IMAGE_BUILD=1`
CircleCI run before/alongside merging this change — no code in this plan needs to handle that
bootstrap step.

## Implementation Steps

### Step 1 — Read the base image version

Read the root `version` file and confirm the current value for `circleci_kerghan-base` (currently
`0.1.0`). This is the exact tag to pin in the CircleCI config — do not hardcode a different
version, and do not use `:latest`.

### Step 2 — Update `backend_tests`

In `.circleci/config.yml`, change the `backend_tests` job:

- `docker: [image: darthjee/circleci_node:0.2.1]` → `docker: [image: darthjee/circleci_kerghan-base:0.1.0]`
- Add `requires: [release-circleci_kerghan-base, release-circleci_kerghan-base-arm64]` to this
  job's entry in the `workflows.test.jobs` list (not inside the `jobs.backend_tests` block itself
  — `requires:` is a workflow-level key, same as the existing `release-image` entries' `filters:`).
- Keep every existing step (`checkout`, `Set folder`, `Yarn install`, `Tests`) unchanged — the
  `Yarn install` step stays; only its speed changes because it now reads from the base image's
  pre-warmed Yarn cache instead of the network.

### Step 3 — Update `backend_checks`

Same two changes as Step 2 (image swap + `requires:`), applied to the `backend_checks` job and
its workflow entry. Keep its existing steps (`checkout`, `Set folder`, `Yarn install`, `Check JS
Lint`) unchanged.

### Step 4 — Leave frontend jobs untouched

Do not modify `jasmine` or `frontend-checks` — they intentionally stay on the generic
`darthjee/circleci_node:0.2.1` image, since no frontend-specific CI base image exists. Do not
introduce one as part of this issue.

### Step 5 — Leave Dockerfiles untouched

Confirm (no edit needed) that `dockerfiles/kerghan/Dockerfile`, `dockerfiles/vite_kerghan/Dockerfile`,
and `dockerfiles/production_kerghan/Dockerfile` already build `FROM` their respective `*-base`
images (`darthjee/kerghan-base:latest`, `darthjee/vite_kerghan-base:latest`,
`darthjee/production_kerghan-base:latest`). This predates the issue; no changes belong here.

### Step 6 — Update `.claude/agents/infra.md`

Its "Backend image publishing" section currently says switching `backend_tests`/`backend_checks`
to `circleci_kerghan-base` "is a follow-up, not done yet." Once Steps 2–3 land, update that
sentence to reflect the new state (both jobs now consume the published `circleci_kerghan-base`
image, pinned to the version in the root `version` file, gated behind `requires:` on the release
job) so the doc doesn't keep describing a gap that no longer exists.

## Files to Change

- `.circleci/config.yml` — swap `backend_tests`/`backend_checks`'s `docker:` image to
  `darthjee/circleci_kerghan-base:0.1.0`, add `requires:` on `release-circleci_kerghan-base`/
  `release-circleci_kerghan-base-arm64` to both jobs' workflow entries.
- `.claude/agents/infra.md` — update the "Backend image publishing" note to describe the
  now-completed switch instead of listing it as a pending follow-up.

## CI Checks

- `.circleci/config.yml`: no local command runs the CircleCI workflow definition itself; validate
  by inspection (YAML correctness, job/workflow key placement) since there is no `circleci config
  validate` tooling wired into this repo's `bin/`/`scripts/`. The `backend_tests`/`backend_checks`
  jobs' own local equivalent remains `docker-compose run kerghan_tests` (job: `backend_tests`,
  `backend_checks`) — unaffected by this change, still runs the same `yarn install`/`npm run
  coverage`/`npm run lint` commands, just against a different CI executor image.

## Notes

- The bootstrap gap (base image never yet published to Docker Hub, since no git tag exists) is a
  known, accepted risk explicitly deferred to a manual `FORCE_IMAGE_BUILD=1` CircleCI run by the
  repo owner — not something this plan's implementation should attempt to automate or work around.
- `requires:` is added at the workflow-job level (inside `workflows.test.jobs`), the same place
  the existing `release-image` entries already use `filters:` — do not confuse this with the
  `jobs.<name>` block, which has no `requires:` concept.
- No new CI secrets, environment variables, or Dockerfile changes are introduced by this issue.
