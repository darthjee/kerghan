# Plan: Standalone: run the whole bats suite under bash 3.2

Issue: [433-standalone-run-the-whole-bats-suite-under-bash-3-2.md](../../issues/433-standalone-run-the-whole-bats-suite-under-bash-3-2.md)

## Overview
The bash 3.2 bats service and CI job run only `standalone/test/completion*.bats`. Two changes:

- they run the whole `standalone/test` suite, and both are renamed `standalone_tests_bash32`;
- the docs and comments that say only completion runs under 3.2 are updated.

On main at fde5226 the whole suite already passes under bash 3.2 (475 ok, exit 0), so no fix in the client or installer is expected. One is made only if a test fails at implementation time.

## Agents involved

- [infra](infra.md): the docker-compose service, the CircleCI job and the Dockerfile comments.
- [standalone](standalone.md): the standalone docs. It also fixes any bash-4-only construct in `standalone/` if a test fails under 3.2.

## Shared contracts

- **docker-compose service:**
  - name: `standalone_tests_bash32`, replacing `bats_bash32`;
  - build context: `./dockerfiles/bats_bash32` (unchanged);
  - image tag: `kerghan_bats_bash32` (unchanged);
  - volume: `./standalone:/standalone:ro`;
  - environment: `KERGHAN_TEST_BASH32: "1"`;
  - command: `bats /standalone/test`.
  - Local run: `docker-compose run --rm standalone_tests_bash32`.
- **CircleCI job:**
  - name: `standalone_tests_bash32`, replacing `standalone_completion_bash32`;
  - test command: `KERGHAN_TEST_BASH32=1 bats standalone/test`;
  - listed in the workflow, and in `release-kerghan-standalone`'s `requires` as `[release-kerghan, standalone_tests, standalone_tests_bash32]`.
- **Unchanged:** the folder `dockerfiles/bats_bash32/`, the `KERGHAN_TEST_BASH32` variable, and the guard test in `completion_safety.bats`.
- **No static lint:** a real bash 3.2 run stays the only guard.
