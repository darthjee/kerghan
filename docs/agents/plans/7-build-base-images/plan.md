# Plan: Build base images

Issue: [7-build-base-images.md](../../issues/7-build-base-images.md)

## Overview

Wire a multi-arch (amd64 + arm64) `release-image` CircleCI job that builds and publishes
Kerghan's 4 base images (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`,
`vite_kerghan-base`) on tag builds, mirroring `majora-3`'s proven pattern (`aux/base-image.md`).
Add a `FORCE_IMAGE_BUILD` override to `bin/image.sh` so the very first publish can bypass the
existing tag/diff guards, since these 4 images have Dockerfiles today but have never actually
been built/pushed despite the repo already having prior git tags.

This is entirely within the `infra` agent's scope (`docker-compose.yml`, `dockerfiles/`,
`.circleci/config.yml`, `bin/`, `Makefile` — see `.claude/agents/infra.md`); no backend, frontend,
or proxy source changes are needed.

## Context

- `dockerfiles/<image>/Dockerfile` and the root `version` file already exist for all 4 base
  images. `bin/image.sh` already has `image_version`, `skip_if_not_tag`, `skip_if_unchanged`,
  `setup_qemu`, `build`, `push` — currently byte-identical to `majora-3/bin/image.sh`.
- `.circleci/config.yml` currently has **no `release-image` job and no workflow entries for it** —
  only `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `proxy_extension_tests`,
  none of which declare a `tags:` filter (so none currently run on tag builds).
- **Scope correction found during planning**: `.claude/agents/infra.md`'s "Backend image
  publishing" section and the `Makefile` currently claim only `vite_kerghan-base` should ever be
  published, with `kerghan-base`/`circleci_kerghan-base`/`production_kerghan-base` staying
  build-only forever. Cross-checked against `majora`, `majora-2`, and `majora-3`'s
  `.circleci/config.yml` (the project this repo is explicitly modeled on) — all three publish
  **all 4** of their equivalent base images via `release-image` jobs, and other jobs `requires:`
  them. Confirmed with the repo owner this Kerghan-side restriction was a stale/postponed
  decision, not an intentional divergence — this plan corrects it back in line with the issue's
  original "all 4 images" scope and with Majora's precedent.
- Per the issue: switching the existing `backend_tests`/`backend_checks`/`jasmine`/
  `frontend-checks` jobs to consume the newly-published base images (and `requires:` the release
  jobs, as Majora's own test jobs do) is explicitly **out of scope** for this issue — left as a
  follow-up once the base images are proven to publish correctly.

## Implementation Steps

### Step 1 — Add `FORCE_IMAGE_BUILD` to `bin/image.sh`

Add a small guard-bypass check reused by `skip_if_not_tag` and `skip_if_unchanged` (the two
functions called by `setup_qemu`, `build`, and `push`): if `FORCE_IMAGE_BUILD` is set (non-empty),
both functions return immediately instead of evaluating/exiting — so `qemu`, `build`, and `push`
all proceed unconditionally. Keep the change minimal — a single early-return check inside each of
the two existing guard functions, no new call sites needed since every guarded function already
funnels through them.

### Step 2 — Add the `release-image` job to `.circleci/config.yml`

Add the parameterized job exactly as documented in `aux/base-image.md` §4 / mirrored from
`majora-3/.circleci/config.yml`:

```yaml
release-image:
  parameters:
    image:
      type: string
    arch:
      type: string
      default: ""
  machine: true
  steps:
    - checkout
    - run:
        name: Set up QEMU
        command: bin/image.sh qemu << parameters.image >>
    - run:
        name: Release
        command: bin/image.sh push << parameters.image >> << parameters.arch >>
```

### Step 3 — Instantiate `release-image` in the `workflows.test.jobs` list

Add 8 entries (native + `arch: arm64` for each of the 4 images), each with a `tags: { only:
/.*/ }` filter (no `branches` key) so the workflow doesn't skip tag builds outright — the actual
"only run on a real tag" decision still happens inside `skip_if_not_tag` in the script, per
`aux/base-image.md`'s "Job filter nuance":

```yaml
- release-image:
    name: release-kerghan-base
    image: kerghan-base
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-kerghan-base-arm64
    image: kerghan-base
    arch: arm64
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-circleci_kerghan-base
    image: circleci_kerghan-base
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-circleci_kerghan-base-arm64
    image: circleci_kerghan-base
    arch: arm64
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-production_kerghan-base
    image: production_kerghan-base
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-production_kerghan-base-arm64
    image: production_kerghan-base
    arch: arm64
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-vite_kerghan-base
    image: vite_kerghan-base
    filters: { tags: { only: /.*/ } }
- release-image:
    name: release-vite_kerghan-base-arm64
    image: vite_kerghan-base
    arch: arm64
    filters: { tags: { only: /.*/ } }
```

Do not add `requires:` from the existing test/lint jobs to these — that coupling is explicitly
out of scope (see Context above).

### Step 4 — Add the missing `push`/`push-base` Makefile targets

`Makefile` currently has `build-base`, `build-circleci-base`, `build-production-base`, and
`build-fe-base`, but only `push-fe-base` — no `push-base`, `push-circleci-base`, or
`push-production-base`. Add them, mirroring `push-fe-base`'s shape (`bin/image.sh push
<image>-base`), so a developer can manually trigger a push for any of the 4 images the same way
CI does. Update the stale comment above the backend targets ("the kerghan/kerghan-base backend
images are not published to Docker Hub...") to remove the now-incorrect claim.

### Step 5 — Correct `.claude/agents/infra.md`

Replace the "Backend image publishing" section (which currently states `kerghan-base`,
`circleci_kerghan-base`, and `production_kerghan-base` are never published) with the corrected
decision: all 4 base images are published via the `release-image` CircleCI job and the
`push`/`push-base`/`push-circleci-base`/`push-production-base`/`push-fe-base` Makefile targets,
matching Majora's precedent. Keep the note that the `kerghan`/`production_kerghan` **leaf app**
images (not the `-base` images) still aren't published — that part of the original decision is
correct and unrelated to this fix (see `kerghan.md` §6/§20 and `docs/agents/issues/7-build-base-images.md`'s
"Scope" section for why the leaf images stay out of scope).

## Files to Change

- `bin/image.sh` — add `FORCE_IMAGE_BUILD` bypass to `skip_if_not_tag` and `skip_if_unchanged`.
- `.circleci/config.yml` — add the `release-image` job definition and 8 workflow instances (4
  images × 2 arches), each with a `tags: { only: /.*/ }` filter.
- `Makefile` — add `push-base`, `push-circleci-base`, `push-production-base` targets; correct the
  stale comment above the backend build targets.
- `.claude/agents/infra.md` — correct the "Backend image publishing" section to reflect that all
  4 base images are published, not just `vite_kerghan-base`.

## CI Checks

- No local test suite exercises `.circleci/config.yml` or `bin/image.sh` directly. Validate with:
  - `circleci config validate` (or CircleCI's config editor) against the updated
    `.circleci/config.yml`, to catch YAML/job-graph errors before pushing.
  - A manual dry run of `bin/image.sh build <image>` locally (e.g. `make build-base`) to confirm
    the Dockerfiles still build, since this plan doesn't touch the Dockerfiles themselves.

## Notes

- **Secrets prerequisite**: per `aux/todo.md`, the CircleCI project doesn't yet have
  `DOCKER_ID_USER`, `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD` configured. The `release-image`
  job will no-op on branch builds (`skip_if_not_tag`) but will fail on an actual tag build until
  these 3 vars are added under CircleCI Project Settings → Environment Variables. Not a blocker
  for merging this plan's code, but call it out in the PR description.
- **`FORCE_IMAGE_BUILD` invocation**: not a persistent CircleCI project variable — set manually
  per pipeline run (CircleCI's "Trigger Pipeline" custom parameters, or a scoped rerun) only when
  a forced rebuild is actually needed. Document this usage in the PR description too.
- **Version-tag reuse**: if `FORCE_IMAGE_BUILD` is used without bumping the image's entry in
  `version`, the push overwrites the existing `:<version>` (and `:latest`) tag on Docker Hub.
  Accepted for this bootstrap case since nothing real is being overwritten yet (see issue's Edge
  Cases section).
- **Partial multi-arch failure**: if one arch's push fails, no automatic rollback — the job just
  fails and can be re-run. Not handled specially, matching Majora's own behavior.
