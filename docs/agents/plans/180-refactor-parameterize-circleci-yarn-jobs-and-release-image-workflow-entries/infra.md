# Infra Plan: Refactor: parameterize CircleCI yarn jobs and release-image workflow entries

Main plan: [plan.md](plan.md)

## Overview
Everything in this issue lives in the infra agent's scope: `.circleci/config.yml`, `docker-compose.yml`, and the CI docs. The change is a pure refactor — the resulting pipeline must be behaviourally identical (same job names, same `requires:`, same images, same steps, same tag filters, same published Docker tags).

## Context
- `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks` share: `checkout` → "Set folder" → `yarn install` → `npm run <script>` (+ an identical best-effort Codacy upload in the two test jobs). They differ only in docker image (`darthjee/circleci_kerghan-base:0.1.0` vs `darthjee/circleci_node:0.2.1`), which folder is kept (`backend` / `frontend`), the npm script (`coverage` / `lint`), and whether coverage is uploaded.
- `upload_fe_files` repeats the frontend "Set folder" + `yarn install` steps on `darthjee/vite_kerghan-base:0.1.0`.
- `release-image` (already a parameterised job with `image` and `arch`) is instantiated eight times in the `test` workflow. amd64 instances have no name suffix and pass an empty `arch`; arm64 instances are named `...-arm64` and pass `arch: arm64`. `bin/image.sh` treats an empty `arch` as `$PLATFORM` with no tag suffix and `arm64` as `linux/arm64` with a `-arm64` tag suffix.
- Job names are referenced in `requires:` (`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `release-circleci_kerghan-base(-arm64)`, `release-production_kerghan-base(-arm64)`, `release-vite_kerghan-base(-arm64)`), in docs, and potentially in GitHub required-status-check names, so they must not change.
- `docker-compose.yml` has no CircleCI validator; project rules forbid running tooling directly on the host, so validation must go through a compose service.

## Steps

- [01 — Add circleci-cli compose service](infra/01-add-circleci-cli-compose-service.md)
- [02 — Parameterise the yarn jobs](infra/02-parameterise-yarn-jobs.md)
- [03 — Matrix the release-image jobs](infra/03-matrix-release-image-jobs.md)
- [04 — Update docs and verify equivalence](infra/04-update-docs-and-verify.md)

## CI Checks
- `.circleci/`, `docker-compose.yml`: no CircleCI job runs on these for a normal push beyond the workflow itself; validate with `docker-compose run --rm circleci config validate` (added in step 01) and compare `config process` output before/after (step 04).
- `backend/` and `frontend/` are not modified, so `backend_tests`/`backend_checks`/`jasmine`/`frontend-checks` have no new local commands — they are exercised by CI on the PR itself.

## Notes
- Implement steps in order: 01 first so steps 02–03 can be validated as they land.
- Capture `config process` output of the **original** config (from `origin/main`) before editing, so step 04 can diff it against the refactored one.
- `circleci config validate` may want network access / an org slug for 2.1 processing; if the CLI complains, use the local-processing flags rather than adding credentials (per the project's no-credentials-in-repo stance). Pin the CLI image tag in the compose file.
- Do not touch `bin/image.sh`: the suffix→arch derivation happens in the CircleCI job step, which is what keeps published Docker tags unchanged.
- Keep the shared `&all_tags` / `&tags_only` YAML anchors; the matrix entry should reuse `*all_tags` instead of the inline `filters: { tags: { only: /.*/ } }` (same value).
