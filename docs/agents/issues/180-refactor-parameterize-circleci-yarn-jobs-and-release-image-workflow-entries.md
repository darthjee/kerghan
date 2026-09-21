# Issue: Refactor: parameterize CircleCI yarn jobs and release-image workflow entries

## Description
`.circleci/config.yml` repeats the same job body four times, repeats the same folder-swap + `yarn install` steps in a fifth job, and declares eight near-identical `release-image` workflow entries.

## Problem
- `backend_tests`, `backend_checks`, `jasmine` and `frontend-checks` each run: checkout → "Set folder" (`rm frontend -rf; cp backend/* ./ -r; rm backend -rf`, or the inverse for frontend) → `yarn install` → an `npm run` script; the two test jobs also upload coverage to Codacy with the identical command.
- `upload_fe_files` repeats the same "Set folder" (frontend variant) + `yarn install` steps against `vite_kerghan-base`.
- The `test` workflow declares eight `release-image` entries (image × {amd64, arm64}), each repeating `name`, `image`, optional `arch` and identical `filters: { tags: { only: /.*/ } }`, and other jobs list those names in `requires`.
- `docker-compose.yml` has no way to validate `.circleci/config.yml`, so a change to it can only be checked by pushing.

## Expected Behavior
- A single parameterised `yarn_project` job (params: `dir`, `image`, `script`, `upload_coverage`) replaces the four job bodies and is invoked four times from the workflow with `name:` set to the existing names (`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`).
- A shared CircleCI `command` holding the "Set folder" + `yarn install` steps is used by both `yarn_project` and `upload_fe_files`, so the folder-swap one-liner exists in exactly one place.
- A single `release-image` `matrix` (`image` × `suffix`, with `suffix` ∈ `""`, `"-arm64"`) replaces the eight entries, with name template `release-<< matrix.image >><< matrix.suffix >>`. Resulting job names (`release-kerghan-base`, `release-kerghan-base-arm64`, …) are byte-identical to today's, so `requires:` entries and any GitHub required-status-check names keep resolving. The job derives `arch` from `suffix` in shell (`${suffix#-}`), so published Docker tags are unchanged.
- The pipeline otherwise runs identically (same images, same steps, same tag filters).
- A CircleCI CLI service in `docker-compose.yml` lets the config be validated repeatably through Docker (e.g. `docker-compose run --rm circleci config validate`).

## Solution
Use one parameterised `yarn_project` job plus a shared `command` for the folder-swap/install steps, and a `matrix` (`image` × `suffix`) with a `name` template for the release jobs, keeping the existing job names. Add a `circleci-cli` service to `docker-compose.yml` (with a documented command) and validate the resulting config through it before merging — never with the CLI installed directly on the host. Update `docs/agents/architecture/infra.md` / `docs/agents/contributing.md` if the job/validation description changes. Owning agent: `infra` (CircleCI pipeline and docker-compose).

## Benefits
Adding a project or architecture becomes a one-line change, the jobs can no longer drift apart, and CircleCI config changes become verifiable locally.
