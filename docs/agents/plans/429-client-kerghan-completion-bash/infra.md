# Infra Plan: Client: `kerghan completion bash`

Main plan: [plan.md](plan.md)

## Shared contracts

- Run exactly `standalone/test/completion*.bats` under bash 3.2.57, with `KERGHAN_TEST_BASH32=1`.
- The only `bash` on `PATH` is 3.2: don't install Alpine's `bash` package, or any package that depends on it.
- bats-core is `v1.11.0`, installed from the upstream tag.
- Names: `dockerfiles/bats_bash32/Dockerfile`, docker-compose service `bats_bash32`, CircleCI job `standalone_completion_bash32`.

## Implementation Steps

### Step 1 — bash 3.2 image and docker-compose service

- **`dockerfiles/bats_bash32/Dockerfile`:**
  - `FROM bash:3.2` (the official image; bash 3.2.57 lives at `/usr/local/bin/bash`);
  - install bats-core `v1.11.0` from the upstream release (tarball or `git clone --depth 1 --branch v1.11.0`), then `./install.sh /usr/local`;
  - remove any build-only package in the same layer;
  - add a header comment on why the image exists: the completion tests on the bash macOS ships, see `docs/agents/specs/auto-complete/README.md#bash-32`.
- **`docker-compose.yml`:** add a `bats_bash32` service next to `standalone_tests`:
  - `build: context: ./dockerfiles/bats_bash32` and `image: kerghan_bats_bash32`, mirroring `scripts_tests`;
  - mount `./standalone:/standalone:ro`;
  - `environment: KERGHAN_TEST_BASH32: "1"`;
  - the glob needs a shell, so run `bash -c 'bats /standalone/test/completion*.bats'`, overriding the entrypoint if the image sets one;
  - a one-line comment in the same style as the neighbouring services.
- **Check:** `docker-compose run --rm bats_bash32 bash -c 'bash --version; command -v bash'` reports 3.2.57 and `/usr/local/bin/bash`.

### Step 2 — CircleCI job

- **`.circleci/config.yml`:** add the job `standalone_completion_bash32`, next to `standalone_tests`:
  - primary image `bash:3.2`;
  - `apk add --no-cache git openssh-client` before `checkout`, as `standalone_tests` does. Check that neither pulls in Alpine's `bash`.
  - install bats-core `v1.11.0` with the same steps as the Dockerfile, which the comment says it mirrors;
  - print `bash --version` and fail unless it reports 3.2;
  - run `KERGHAN_TEST_BASH32=1 bats standalone/test/completion*.bats`.
- **Workflow:**
  - add `- standalone_completion_bash32: filters: *all_tags` to the `test` workflow, after `standalone_tests`;
  - add it to the `requires` of `release-kerghan-standalone`, next to `standalone_tests`, so a release can't ship a completion that breaks on bash 3.2.

## Files to Change

- `dockerfiles/bats_bash32/Dockerfile`: new; bash 3.2 plus bats-core 1.11.0.
- `docker-compose.yml`: new `bats_bash32` service.
- `.circleci/config.yml`: new `standalone_completion_bash32` job, plus its workflow entry and the release `requires`.

## CI Checks

- `standalone/`: `docker-compose run --rm bats_bash32` (CI job: `standalone_completion_bash32`) and `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`).

## Notes

- The tests can only pass once standalone has written them. Until then the glob matches nothing, and bats fails on a missing file. Land both in the same PR.
- Don't change `standalone_tests`. The full suite keeps running on bash 5 only; running it under 3.2 is #433.
