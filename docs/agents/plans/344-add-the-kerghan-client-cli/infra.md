# Infra Plan: Add the kerghan client CLI

Main plan: [plan.md](plan.md)

## Shared contracts

- The standalone agent provides `standalone/bin/kerghan`, with exactly one column-0 line
  `KERGHAN_VERSION="X.Y.Z"`, and the bats suite in `standalone/test/`. The suite runs with
  `bats /standalone/test` under `bats/bats:1.11.0`, needing nothing but bash and bats.
- You provide:
  - the `standalone_tests` compose service, so that
    `docker-compose run --rm standalone_tests` runs the suite;
  - a CircleCI `standalone_tests` job on all branches and tags, required by
    `release-kerghan-standalone`;
  - the `bump_version.sh` rewrite of the version line.

## Implementation Steps

### Step 1 — Test service and CI job

- **`docker-compose.yml`:** add the following next to `proxy_tests`, with a one-line comment
  in the style of the surrounding services:

  ```yaml
  standalone_tests:
    image: bats/bats:1.11.0
    volumes:
      - ./standalone:/standalone:ro
    command: /standalone/test
  ```

- **`.circleci/config.yml`:** add a `standalone_tests` job (Docker executor
  `bats/bats:1.11.0`). It checks out the repo and runs `bats standalone/test`. The image's
  entrypoint is `bats`, so either override it, or give the job's `run` step an explicit
  `bats` call with the checkout path. Make sure the image has what CircleCI's `checkout` step
  needs (`git`, `ssh`). If it does not, check out with a `cimg/base` primary image and install
  bats there, or run `docker run` against `bats/bats:1.11.0` under `setup_remote_docker`.
  Pick the simplest one that works, and leave a comment saying why.
- Add the job to the `test` workflow with `filters: *all_tags`. Add it to
  `release-kerghan-standalone`'s `requires`, so a broken client never ships with the image.

### Step 2 — Pin the version in `bump_version.sh`

- Add `CLI="$ROOT/standalone/bin/kerghan"` next to the other paths.
- Add a `sed -i ''` block, in the same style as the existing ones, that rewrites
  `^KERGHAN_VERSION="[0-9.]*"` to `KERGHAN_VERSION="${new_version}"`.
- Guard it with `[ -f "$CLI" ]` so the script keeps working if the file moves.

## Files to Change
- `docker-compose.yml` — the `standalone_tests` service
- `.circleci/config.yml` — the `standalone_tests` job, its workflow entry, and
  `release-kerghan-standalone` requiring it
- `scripts/bump_version.sh` — rewrite `KERGHAN_VERSION=` in `standalone/bin/kerghan`

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- CircleCI config: `docker-compose run --rm circleci circleci config validate` (if the
  `circleci` service supports it; otherwise rely on the pipeline run)

## Notes

- `bump_version.sh` uses BSD `sed -i ''` (macOS). Keep the same form for consistency.
- Depends on the standalone agent's `standalone/test/` existing for the job to pass. Land them in
  the same PR.
