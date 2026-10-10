# Add bats tests for the deploy scripts

Cover the required behavior with a bats suite that stubs `curl` (recording calls and returning
canned JSON) and `sleep`, following the `standalone/test` stub pattern. Install `jq` in the test
container or provide it via the image used (bats/bats is Alpine: `apk add jq`, or build a small
test image).

Cases:

- `deploy` on tag `X` POSTs to `/services/<id>/deploys` with body
  `{"imageUrl":"docker.io/darthjee/kerghan:X"}` and exits 0 once the status is `live`.
- `deploy_image <tag>` does the same for an arbitrary (rollback) tag.
- A failed status (`build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`,
  `deactivated`) exits non-zero.
- An empty tag or `latest` is rejected without calling the Render API.
- No PATCH request (branch/source change) is ever issued.

Wire it up as a compose service (e.g. `scripts_tests`, mounting `./scripts`) and a CircleCI job
`scripts_tests` running on every push, added to `build-and-release`'s requirements alongside the
other test jobs.

## Files to Change

- `scripts/test/*.bats`, `scripts/test/stubs/*`, helpers — new test suite
- `docker-compose.yml` — `scripts_tests` service
- `.circleci/config.yml` — `scripts_tests` job and workflow entry
