# Deploy the image from the Render scripts

Replace the branch-switching flow with an image deploy and add a rollback entry point.

- `scripts/render.sh`:
  - Delete `update_service_branch`.
  - `deploy SERVICE_ID IMAGE_URL`: `POST https://api.render.com/v1/services/$SERVICE_ID/deploys`
    with `Content-Type: application/json` and body `{"imageUrl": "<IMAGE_URL>"}` (build the body
    with `jq -n --arg` to avoid quoting issues). Make the request fail loudly on HTTP errors
    (e.g. `curl -sS --fail-with-body`) so a rejected imageUrl does not leave `DEPLOYMENT_ID=null`.
  - Fix `last_deployment` to take `SERVICE_ID` as `$1`.
- `scripts/deploy.sh`:
  - Add `image_url TAG` → `docker.io/darthjee/kerghan:$TAG`; exit 1 when the tag is empty or
    `latest`.
  - `force_deploy TAG`: resolve `service_id`, call `deploy "$SERVICE_ID" "$(image_url "$TAG")"`,
    exit 1 if the returned deploy id is empty or `null`, then `watch_deployment`.
  - `run_deploy` (CI, `deploy` action): `checkLastVersion; force_deploy "$CIRCLE_TAG"`.
  - Add `deploy_image TAG` (rollback/manual, no `checkLastVersion`): `force_deploy "$TAG"`.
  - Remove `update_deploy_branch` and its dispatcher arm; pass the remaining arguments through
    in the dispatcher (`deploy_image <tag>`).
  - Treat `pre_deploy_failed` as a failure in `check_deployment_status`; replace `$[ ]` with
    `$(( ))`.
  - Make sourcing `render.sh` work regardless of cwd (resolve it relative to the script dir) so
    the tests can run it.

## Files to Change

- `scripts/render.sh` — image deploy request, remove `update_service_branch`, fix `last_deployment`
- `scripts/deploy.sh` — `image_url`, `deploy_image`, tag-based `force_deploy`, remove
  `update_deploy_branch`, dispatcher arguments, status handling
