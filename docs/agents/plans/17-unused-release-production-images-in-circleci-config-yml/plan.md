# Plan: Unused release-production images in .circleci/config.yml

Issue: [17-unused-release-production-images-in-circleci-config-yml.md](../../issues/17-unused-release-production-images-in-circleci-config-yml.md)

## Overview

`build-and-release` triggers the Render deploy of `production_kerghan` (which is `FROM
darthjee/production_kerghan-base:latest`) without waiting for `release-production_kerghan-base`/
`release-production_kerghan-base-arm64` to finish pushing the freshly built base image to Docker
Hub — a race condition where Render can pull a stale `latest`. This plan adds the missing
`requires` entries to `build-and-release` (mirroring Majora's equivalent job) and creates the
missing `docs/agents/architecture/infra.md` documenting the release pipeline's job graph. Entirely
within the `infra` agent's scope (`.circleci/config.yml`, docs about the pipeline) — no other
agent has work here.

## Context

- `.circleci/config.yml`'s `test` workflow declares `release-production_kerghan-base` and
  `release-production_kerghan-base-arm64` as `release-image` jobs (filters:
  `{ tags: { only: /.*/ } }`), but nothing `requires` them.
- `build-and-release` (`filters: *tags_only`, i.e. semver tags only) currently requires only
  `[backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]`.
- `release` (the final atomic-swap job) requires `build-and-release` among others, but per the
  issue's resolved discussion, does **not** need to require the two production-base jobs directly
  — it's already transitively protected once `build-and-release` requires them (CircleCI only
  starts a job once everything in its `requires` list has finished successfully).
- `docs/agents/architecture/infra.md` does not exist yet; only `backend.md`, `frontend.md`,
  `proxy.md` exist under `docs/agents/architecture/`. Majora's `.claude/agents/infra.md` has a
  "CircleCI pipeline (.circleci/config.yml)" section (ASCII workflow diagram + CI jobs table) to
  use as a model, adapted to Kerghan's actual jobs (no `link_photos`/`link_files`/
  `upload_admin_assets`/`wake-navi` equivalents — Kerghan's chain is
  `build-and-release`/`upload_proxy_files`/`upload_fe_files` → `release`).

## Implementation Steps

### Step 1 — Fix the missing `requires` in `.circleci/config.yml`

In the `test` workflow's `build-and-release` job entry, add
`release-production_kerghan-base` and `release-production_kerghan-base-arm64` to its `requires`
list, alongside the existing `[backend_tests, backend_checks, jasmine, frontend-checks,
proxy_extension_tests]`. Do not touch `release`'s `requires` list (see Context above).

### Step 2 — Validate the CircleCI config

Run `circleci config validate` locally (or `circleci config validate .circleci/config.yml` if not
run from the repo root) to catch YAML/graph errors before pushing — there's no way to exercise the
actual tag-triggered pipeline locally.

### Step 3 — Create `docs/agents/architecture/infra.md`

Write a new architecture doc describing the CircleCI release pipeline's job graph:
- A workflow diagram (ASCII, in the style of Majora's `.claude/agents/infra.md`) showing the full
  `test` workflow: `backend_tests`/`backend_checks`/`jasmine`/`frontend-checks`/
  `proxy_extension_tests` → `build-and-release`/`upload_proxy_files`/`upload_fe_files` →
  `upload_extension`/`copy_proxy_configuration` → `release`, plus the `release-image` jobs
  (`release-kerghan-base(-arm64)`, `release-circleci_kerghan-base(-arm64)`,
  `release-production_kerghan-base(-arm64)`, `release-vite_kerghan-base(-arm64)`) and where each
  feeds into the graph (including the corrected `build-and-release` →
  `release-production_kerghan-base(-arm64)` edge from Step 1).
- A CI jobs table (job name, image/executor, purpose) mirroring Majora's format.
- A short note on the semver-only vs. any-tag filter split between `build-and-release`/`release`
  and the `release-image` jobs (see the issue's "Edge cases" section), since it's non-obvious and
  already caused this bug once.

Link the new doc from `docs/agents/summary.md` and `AGENTS.md`'s documentation table (both list
every doc under `docs/agents/`), and update `docs/agents/folder-structure.md`'s reference to
`architecture/backend.md` for the image family — if the Docker Hub publishing story now belongs in
`infra.md` instead, point there.

## Files to Change

- `.circleci/config.yml` — add `release-production_kerghan-base` and
  `release-production_kerghan-base-arm64` to `build-and-release`'s `requires`.
- `docs/agents/architecture/infra.md` — new file, release pipeline job graph documentation.
- `docs/agents/summary.md` — add a one-line entry for the new doc.
- `AGENTS.md` — add a row for the new doc in the documentation table.
- `docs/agents/folder-structure.md` — update the `dockerfiles/` section's pointer if it should now
  reference `infra.md` instead of (or in addition to) `architecture/backend.md`.

## CI Checks

- `.circleci/`: no local equivalent — `build-and-release`, `upload_proxy_files`, `upload_fe_files`,
  `release`, `warm-up-cache` only run on tagged releases (per `docs/agents/contributing.md`).
  Verify by reading the job definitions in `.circleci/config.yml` and running
  `circleci config validate` (CI job: implicit — CircleCI itself rejects an invalid config at
  pipeline trigger time).

## Notes

- No functional/runtime code changes — this is a CI ordering fix plus documentation. Nothing to
  test beyond config validation and a careful read of the resulting `requires` graph.
- The next real tagged release is the actual end-to-end verification that
  `release-production_kerghan-base(-arm64)` now gate `build-and-release`; this can't be simulated
  locally or in a PR (release jobs are gated to tag pushes only).
- Out of scope (per the issue's Scope decision): reconciling `release`'s `requires` list to
  exhaustively list every `release-image` job the way Majora's does — Kerghan's other release-image
  jobs are already safely ordered transitively.
