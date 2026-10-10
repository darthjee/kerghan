# CircleCI job

In `.circleci/config.yml`:

- Add a `release-kerghan-standalone` job, defined like `release-kerghan`:
  - `machine: image: ubuntu-2204:current`;
  - `checkout`;
  - run `bin/release_kerghan_standalone.sh release`, step name
    "Release darthjee/kerghan-standalone".
- Add it to the workflow with `requires: [release-kerghan]` and `filters: *tags_only`.

The job uses the same Docker Hub env vars as `release-kerghan` (`DOCKER_ID_USER`,
`DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`).

## Files to Change

- `.circleci/config.yml`: new job definition and workflow entry.
