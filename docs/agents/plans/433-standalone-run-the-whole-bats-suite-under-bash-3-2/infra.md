# Infra Plan: Standalone: run the whole bats suite under bash 3.2

Main plan: [plan.md](plan.md)

## Shared contracts

Produce the service and job exactly as in [plan.md](plan.md#shared-contracts):

- **docker-compose:** service `standalone_tests_bash32`, running `bats /standalone/test` with `KERGHAN_TEST_BASH32: "1"`;
- **CircleCI:** job `standalone_tests_bash32`, running `KERGHAN_TEST_BASH32=1 bats standalone/test`, and required by `release-kerghan-standalone`;
- **kept as is:** the `dockerfiles/bats_bash32/` folder and the `kerghan_bats_bash32` image tag.

## Implementation Steps

### Step 1 — docker-compose service
In `docker-compose.yml`:

- rename the service `bats_bash32` to `standalone_tests_bash32`;
- change its command from `bash -c 'bats /standalone/test/completion*.bats'` to `bats /standalone/test`;
- reword the comment above it to "whole standalone bats suite (standalone/test) on bash 3.2.57, the bash macOS ships".

The `bash:3.2` image's entrypoint passes a command that doesn't start with `-` to `exec`, so `bats …` runs directly. If it doesn't, keep the `bash -c '…'` form.

### Step 2 — CircleCI job and Dockerfile comments
In `.circleci/config.yml`:

- rename the job `standalone_completion_bash32` to `standalone_tests_bash32`, in three places: the job definition, the workflow entry, and `release-kerghan-standalone`'s `requires`;
- change the Tests step to `KERGHAN_TEST_BASH32=1 bats standalone/test`;
- reword the comment above the job: the whole standalone suite, not just the completion tests. It keeps the `client-completion.md#bash-32` link and still notes that it mirrors `dockerfiles/bats_bash32`.

In `dockerfiles/bats_bash32/Dockerfile`, change only the header comment: it runs the whole `standalone/test` suite, and its CircleCI job is now `standalone_tests_bash32`. The build steps don't change.

## Files to Change
- `docker-compose.yml`: rename the service, change its command, update its comment.
- `.circleci/config.yml`: rename the job and both references to it, change its test command, update its comment.
- `dockerfiles/bats_bash32/Dockerfile`: header comment only.

## CI Checks
- `standalone/`, on bash 3.2: `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`).
- `standalone/`, on bash 5: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`).

## Notes
- Run `docker-compose build standalone_tests_bash32` once before the first run if the image isn't built.
- The bash 3.2 job now runs about 475 tests instead of only the completion files, so it takes longer. Nothing else waits on it except `release-kerghan-standalone`, which runs only on tags.
