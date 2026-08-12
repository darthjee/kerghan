# Unused release-production images in .circleci/config.yml

## Context

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

## What needs to be done

- **CI (`.circleci/config.yml`)**: add `release-production_kerghan-base` and
  `release-production_kerghan-base-arm64` to `build-and-release`'s `requires` list, mirroring
  Majora's `build-and-release` job, so the production base image is guaranteed to be freshly
  pushed to Docker Hub before Render is triggered to build/deploy `production_kerghan` from it.
- Double check whether `release` (the final atomic-swap job) should also require these two jobs
  directly, the way Majora's `release` job does, or whether transitively depending on
  `build-and-release` is sufficient for Kerghan's simpler Render-based backend deploy.
- Docs: if `docs/agents/architecture/infra.md` (or equivalent) describes the release pipeline's
  job graph, update it to reflect the corrected dependency.

## Acceptance criteria

- [ ] `build-and-release` in `.circleci/config.yml` requires
      `release-production_kerghan-base` and `release-production_kerghan-base-arm64` in addition to
      the existing test/lint jobs.
- [ ] The change is verified against Majora's equivalent `build-and-release`/`release` job
      dependencies for consistency, with any intentional divergence documented.
- [ ] No workflow job is left building an image that nothing in the graph depends on.
