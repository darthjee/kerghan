# Issue: Unused release-production images in .circleci/config.yml

## Description

`.circleci/config.yml`'s `test` workflow builds the production backend base image
(`release-production_kerghan-base` / `release-production_kerghan-base-arm64`, gated to tag
pushes) but nothing in the workflow requires them — `build-and-release`, the job that triggers
the Render deploy, doesn't wait for them to finish pushing to Docker Hub before firing.

## Problem

`.circleci/config.yml`'s `test` workflow defines two `release-image` jobs for the production
backend base image — `release-production_kerghan-base` and `release-production_kerghan-base-arm64`
(building `dockerfiles/production_kerghan-base/Dockerfile`, gated to tag pushes via
`filters: { tags: { only: /.*/ } }`) — but nothing in the workflow lists them as a dependency.
`build-and-release` (the job that triggers the Render deploy) only requires
`[backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]`; the other
release-image jobs (`release-kerghan-base(-arm64)`, `release-circleci_kerghan-base(-arm64)`,
`release-vite_kerghan-base(-arm64)`) are required somewhere downstream, but the two
`release-production_kerghan-base` jobs are not required by anything at all.

This is not cosmetic: `dockerfiles/production_kerghan/Dockerfile` starts with
`FROM darthjee/production_kerghan-base:latest`, i.e. the production backend image is built on
top of the `production_kerghan-base` image pulled from Docker Hub by tag `latest`. Render is
triggered to build/deploy from that Dockerfile as soon as `build-and-release` runs
(`scripts/deploy.sh update_deploy_branch` + `scripts/deploy.sh deploy`, per `build-and-release`'s
steps in `.circleci/config.yml`). If `release-production_kerghan-base(-arm64)` haven't finished
pushing the freshly built base image to Docker Hub before that trigger fires, Render's build can
pull a stale `production_kerghan-base:latest` — a race condition, not just a lint nit.

Majora's `.circleci/config.yml` (the sibling project Kerghan's pipeline is modeled after) avoids
this: its `build-and-release` job explicitly requires
`release-production_majora-base` and `release-production_majora-base-arm64` before triggering the
equivalent Render deploy, even though `build-and-release`'s own steps don't reference the image
directly either — the dependency exists purely to sequence the Docker Hub push ahead of the
deploy trigger.

## Expected Behavior

`build-and-release` should never trigger the Render deploy until
`release-production_kerghan-base` and `release-production_kerghan-base-arm64` have finished
pushing the freshly built image to Docker Hub, so `production_kerghan`'s
`FROM darthjee/production_kerghan-base:latest` always resolves to the image built for this
release, never a stale one. `release` (the final atomic-swap job) doesn't need its own direct
dependency on these jobs — it already transitively waits on `build-and-release`.

## Solution

### Scope

This issue is scoped to the surgical fix only: add `release-production_kerghan-base` and
`release-production_kerghan-base-arm64` to `build-and-release`'s `requires`, and separately decide
whether `release` also needs to require them directly (see below).

Explicitly **out of scope**: reconciling Kerghan's `release` job to exhaustively list every
`release-image` job as a direct `requires`, the way Majora's `release` job does (Majora lists
`release-majora-base(-arm64)` and `release-circleci_majora-base(-arm64)` directly even though
they're already covered transitively). Kerghan's `release-kerghan-base(-arm64)` and
`release-circleci_kerghan-base(-arm64)` are already safely ordered — they're transitively required
via `backend_tests`/`backend_checks`/`jasmine`/`frontend-checks`, all of which run before
`build-and-release`/`release` in the graph — so there's no race condition to fix there, only a
stylistic divergence from Majora. Not worth the added verbosity without a real bug behind it.

### What needs to be done

- **CI (`.circleci/config.yml`)**: add `release-production_kerghan-base` and
  `release-production_kerghan-base-arm64` to `build-and-release`'s `requires` list, mirroring
  Majora's `build-and-release` job, so the production base image is guaranteed to be freshly
  pushed to Docker Hub before Render is triggered to build/deploy `production_kerghan` from it.
- `release` (the final atomic-swap job) does **not** need to require these two jobs directly — see
  "Should `release` also require these jobs directly?" below for the reasoning.
- **Docs**: create `docs/agents/architecture/infra.md` — it doesn't exist yet in this repo (only
  `backend.md`, `frontend.md`, `proxy.md` do under `docs/agents/architecture/`), and no other doc
  currently describes the release pipeline's job graph. Use Majora's `.claude/agents/infra.md` —
  specifically its "CircleCI pipeline (.circleci/config.yml)" section (the workflow diagram and
  the CI jobs table) — as a model for shape/level of detail, adapted to Kerghan's actual jobs and
  to Kerghan's simpler Render-based deploy (no `link_photos`/`link_files`/`upload_admin_assets`/
  `wake-navi` equivalents). The new doc should reflect the corrected `build-and-release` →
  `release-production_kerghan-base(-arm64)` dependency from this issue.

### Should `release` also require these jobs directly?

No — decided not to duplicate the requirement on `release`.

`release` already requires `build-and-release`, and CircleCI only starts a job once every job in
its `requires` list has finished successfully. Once `build-and-release` requires
`release-production_kerghan-base(-arm64)`, `release` is transitively blocked on them too — the
ordering guarantee holds without touching `release` at all, and there's no failure-propagation gap
either (if the production-base jobs fail, `build-and-release` never runs, so `release` never runs).

Majora's `release` job lists them directly anyway, which does add a small guard against a future
refactor of `build-and-release`'s own `requires` list silently dropping the dependency. That
tradeoff was considered and rejected for Kerghan: `build-and-release` here is a small,
single-purpose job (just the two deploy-trigger steps) that's unlikely to be casually restructured,
and the extra lines would read as redundant/confusing without a comment explaining why they're
there. Consistent with the Scope decision above to not chase full Majora parity where there's
no real bug behind it.

### Edge cases considered

- **Branch pushes**: `release-image` jobs have no `branches` filter, so CircleCI schedules them on
  every branch push too, but `bin/image.sh`'s `skip_if_not_tag` immediately exits when
  `$CIRCLE_TAG` is unset — no image is actually built/pushed. `build-and-release` never runs on
  branch pushes at all (`branches: {ignore: /.*/}`). No interaction with this fix.
- **Filter compatibility**: `release-image` jobs filter on `tags: {only: /.*/}` while
  `build-and-release`/`release` filter on the semver-only `/\d+\.\d+\.\d+/`. Since every semver tag
  also matches `/.*/`, whenever `build-and-release` runs, `release-production_kerghan-base(-arm64)`
  are guaranteed to also be scheduled in that same pipeline instance — the new `requires` can never
  point at a job CircleCI decided to skip in that run.
- **Unchanged base image**: `bin/image.sh`'s `skip_if_unchanged` lets
  `release-production_kerghan-base(-arm64)` exit 0 quickly (no rebuild/push) when
  `dockerfiles/production_kerghan-base/` hasn't changed since the last tag. `build-and-release`
  just waits on that fast no-op success; Docker Hub still holds the correct image from the prior
  release.
- **Related but out of scope**: pushing a non-semver tag (e.g. `checkpoint`) still triggers a real
  build+push of `production_kerghan-base:latest` (and the other base images) via `release-image`'s
  broader `/.*/` tag filter, even though it never triggers `build-and-release`/`release` in that
  same pipeline. That's a pre-existing gap in tag hygiene, independent of this issue's ordering fix
  — not addressed here.

### Backward compatibility

No risk to already-run pipelines — CircleCI config changes only apply to future runs. This mirrors
an existing, proven pattern: `upload_fe_files` already requires `release-vite_kerghan-base(-arm64)`,
a `release-image` job filtered the same way as `production_kerghan-base`. The one real behavioral
change is possible added latency to the deploy trigger: `build-and-release` now also waits on
`release-production_kerghan-base(-arm64)`, which only costs meaningful wall-clock time on releases
where `dockerfiles/production_kerghan-base/` actually changed (see "Edge cases" above) and only if
that build takes longer than the parallel test/lint suite. That's the intended
correctness-over-speed trade-off, not a defect, and the change is trivially revertible (a one-line
diff) if it ever needs to be undone.

### Performance & security

- **Performance**: same latency analysis as Backward compatibility above — bounded and mostly
  hidden behind `skip_if_unchanged`, not worth mitigating (e.g. build caching, dropping arm64 QEMU)
  as part of this issue.
- **Security**: `requires` only affects job ordering, not credential/secret sharing, so this change
  doesn't grant `build-and-release` access to anything it didn't have before. More importantly, this
  fix is itself a supply-chain integrity improvement: it guarantees Render always deploys
  `production_kerghan` built from a base image that was actually just pushed for this release,
  rather than whatever happened to be sitting at `production_kerghan-base:latest` (which, per the
  non-semver-tag edge case above, could in theory be from an unrelated tag push).

### Acceptance criteria

- [ ] `build-and-release` in `.circleci/config.yml` requires
      `release-production_kerghan-base` and `release-production_kerghan-base-arm64` in addition to
      the existing test/lint jobs.
- [ ] `release`'s `requires` list is left unchanged (relies on the transitive dependency through
      `build-and-release`), per the decision above.
- [ ] No workflow job is left building an image that nothing in the graph depends on.
- [ ] `docs/agents/architecture/infra.md` exists and documents the release pipeline's job graph,
      modeled on Majora's `.claude/agents/infra.md` CircleCI section.

## Benefits

- Closes a real race condition that could deploy `production_kerghan` on top of a stale
  `production_kerghan-base:latest` image.
- Brings Kerghan's release pipeline in line with Majora's proven ordering for the same job shape.
- Adds the release pipeline's job graph documentation that's currently missing entirely from this
  repo.
