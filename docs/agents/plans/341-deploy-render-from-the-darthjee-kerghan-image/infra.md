# Infra Plan: Deploy Render from the darthjee/kerghan image

Main plan: [plan.md](plan.md)

## Overview

Switch the Render deploy from "point the service branch at the git tag, then trigger a deploy" to
"trigger a deploy of the exact image `docker.io/darthjee/kerghan:<tag>`", keep `watch_deployment`,
add a rollback entry point, cover the scripts with bats tests, gate `build-and-release` on
`release-kerghan`, and document the result.

## Context

- `scripts/render.sh` `deploy SERVICE_ID` sends `POST /v1/services/{id}/deploys` with no body;
  `update_service_branch` PATCHes `{"branch": ...}`. `last_deployment` reads a global `$SERVICE_ID`.
- `scripts/deploy.sh` exposes `deploy` (`checkLastVersion; force_deploy`), `force_deploy`, `watch`,
  `service_id` and `update_deploy_branch`; its dispatcher does not pass arguments through.
  `check_deployment_status` does not treat `pre_deploy_failed` as a failure.
- `.circleci/config.yml`: `build-and-release` (workflow lines ~51-62) requires the five test jobs
  plus `release-production_kerghan-base(-arm64)`; its job (~300-313) runs
  `scripts/deploy.sh update_deploy_branch` then `scripts/deploy.sh deploy`. `release-kerghan`
  already exists (multi-arch `darthjee/kerghan:<tag>` + `:latest`) and still requires the
  production-base jobs, so the ordering stays transitive.
- No tests exist for `scripts/`. The standalone bats suite (`standalone/test`, compose service
  `standalone_tests`, CircleCI `standalone_tests`) shows the curl-stub pattern to reuse.
- The standalone spec (`docs/agents/specs.md` → Standalone distribution, Render page) lists the
  required tests: imageUrl set to the tag then waits for `live`; failed status exits non-zero; no
  call changes the branch/source; `build-and-release` cannot run before `release-kerghan`.

## Steps

- [01 — Deploy the image from the Render scripts](infra/01-deploy-image-scripts.md)
- [02 — Add bats tests for the deploy scripts](infra/02-scripts-bats-tests.md)
- [03 — Gate build-and-release on release-kerghan](infra/03-circleci-build-and-release.md)
- [04 — Document the Render image deploy (architect)](infra/04-docs.md)

## CI Checks

- `.circleci/config.yml`: `docker-compose run --rm circleci config validate` and
  `docker-compose run --rm circleci config process .circleci/config.yml`
- `scripts/`: the new bats compose service, e.g. `docker-compose run --rm scripts_tests`
  (CI job: `scripts_tests`)

## Notes

- Render requires the `imageUrl` repo to match the service's configured image, so the manual
  "Existing Image" switch must be done before the first CI image deploy; otherwise the API call
  fails (loudly, thanks to the error guard in step 01). This is called out in the checklist.
- Step 04 edits `docs/agents/`, which is architect scope; the architect applies it.
- Never deploy `latest`: `image_url` rejects an empty tag and `latest`.
- Run every tool through `docker-compose`, never on the host.
