# Revert the deploy scripts to the branch flow with a version guard

Restore the Git-backed deploy (point the service branch at the tag, plain deploy, watch) while
keeping #341's non-image hardening, and add a guard that the thin Dockerfile matches the tag.

`scripts/render.sh`:
- Restore `update_service_branch SERVICE_ID BRANCH`: `PATCH /v1/services/$SERVICE_ID` with
  `{"branch": "<branch>"}` (build the body with `jq -nc --arg`, like the current `deploy`, and use
  `-sS --fail-with-body` so a rejected PATCH fails).
- `deploy SERVICE_ID`: plain `POST /v1/services/$SERVICE_ID/deploys` with no body/`imageUrl`, still
  `-sS --fail-with-body`.

`scripts/deploy.sh`:
- Remove `IMAGE_REPOSITORY`, `image_url`, `deploy_image` (and its case entry).
- Add `RENDER_DOCKERFILE="${RENDER_DOCKERFILE:-$SCRIPTS_DIR/../dockerfiles/production_kerghan/Dockerfile}"`
  (overridable for tests) and a `check_dockerfile_version TAG` function: reject an empty tag; read
  the tag from the `FROM darthjee/kerghan:<tag>` line; if it differs from `TAG` (or the file/line is
  missing), print an error naming both values (e.g.
  `dockerfile version mismatch: <file> has <x>, release is <tag> (run scripts/bump_version.sh)`) to
  stderr and exit 1.
- `force_deploy TAG`: `check_dockerfile_version` → `service_id` (keep the "render service not
  found" error) → `update_service_branch "$SERVICE_ID" "$TAG"` (fail with a clear message if it
  errors) → `deploy "$SERVICE_ID"` (keep "deploy request failed" and the "returned no deploy id"
  checks) → `watch_deployment`. The guard runs before any Render API call.
- `run_deploy`: `checkLastVersion` then `force_deploy "$CIRCLE_TAG"` (unchanged shape).
- Keep `pre_deploy_failed` in the failure list, `watch`, `service_id` and the `*) $ACTION "$@"`
  fallthrough. Restore an `update_deploy_branch` action only if useful for manual use; not required.

`.circleci/config.yml`: `build-and-release` keeps `ubuntu-2204:current`, keeps requiring
`release-kerghan` and `scripts_tests`, and still runs `scripts/deploy.sh deploy` (the branch update is
now inside it). Rename the step to e.g. "Deploy release tag to Render" and rewrite the job comment
(Render builds `dockerfiles/production_kerghan/Dockerfile` = `FROM darthjee/kerghan:<tag>` from the
tag; the branch is moved to the tag; no rollback command). Update the `release-kerghan` comment on
the `build-and-release` requires list accordingly.

Tests (`scripts/test/`):
- `stubs/curl`: handle `PATCH $api/services/srv-123` (log it, echo the service JSON; support a
  `STUB_PATCH_FAIL=1` failure like `STUB_DEPLOY_FAIL`); the POST stub's failure message should no
  longer mention imageUrl.
- `helpers/setup.bash`: create a temp thin Dockerfile per test and export `RENDER_DOCKERFILE` to it
  (helper e.g. `write_dockerfile <tag>`, defaulting to the tag under test); replace `deploy_post`
  with helpers for the expected PATCH line (`{"branch":"<tag>"}`) and the plain POST line; unset
  `RENDER_DOCKERFILE`/`STUB_PATCH_FAIL` in setup and drop `IMAGE_REPOSITORY`.
- `deploy.bats`, rewrite to cover: deploy on the latest tag logs PATCH branch=<tag> then a POST with
  no data, then watches until live (PATCH before POST); non-latest tag skips with no curl; version
  mismatch and a missing FROM line fail with no curl at all; deploy without `CIRCLE_TAG` fails with
  no curl; unknown service name fails without PATCH/POST; rejected PATCH fails without POST; rejected
  POST and response without id fail without watching; timeout; `watch`; each failed status
  (`build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`, `deactivated`). Drive these
  through `force_deploy <tag>` or `deploy` as convenient. Remove the image-only tests (`imageUrl`
  body, `deploy_image`, latest/empty image tag, "no call ever changes the branch", "update_deploy_branch
  no longer exists").
- Run `docker-compose run --rm scripts_tests` until green.

## Files to Change
- `scripts/render.sh` — restore `update_service_branch`; `deploy` posts without `imageUrl`
- `scripts/deploy.sh` — branch-update flow, Dockerfile version guard, remove image/rollback code
- `.circleci/config.yml` — `build-and-release` step name and comments
- `scripts/test/stubs/curl` — PATCH support and failure switch
- `scripts/test/helpers/setup.bash` — temp thin Dockerfile, new expected-call helpers
- `scripts/test/deploy.bats` — tests for the new flow and the guard
