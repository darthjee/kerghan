# Issue: Standalone: run the whole bats suite under bash 3.2

## Description

The standalone client (`standalone/bin/kerghan`) and the installer (`standalone/install.sh`) claim bash 3.2 support (`docs/agents/standalone.md`: "bash 3.2 or later"). However, CI only runs the completion tests (`standalone/test/completion*.bats`) under bash 3.2. The rest of the suite runs only on `bats/bats:1.11.0`, which ships bash 5.

The autocomplete Epic (#424) added the bash 3.2 bats image (`dockerfiles/bats_bash32/Dockerfile`, `FROM bash:3.2`), the `bats_bash32` docker-compose service and the `standalone_completion_bash32` CircleCI job, all limited to the completion glob. This issue extends them to the whole `standalone/test` suite.

**Already verified:** on 2026-11-02 (main at fde5226), `docker-compose run --rm bats_bash32 bash -c 'bats /standalone/test'` passed all 475 tests (exit 0). The only skips were:

- the two tests that are also skipped on bash 5 (read-only install dir as root, `dockerfiles/` not mounted);
- the bash-4-only `command_not_found_handle` check, which skips by design.

So no bash-4-only construct needs fixing today. This issue only wires the full suite in and updates the docs.

## Expected Behavior

- **docker-compose:** the `bats_bash32` service is renamed `standalone_tests_bash32`. It runs the whole suite (`bats /standalone/test`) and keeps `KERGHAN_TEST_BASH32=1`.
- **CircleCI:**
  - the `standalone_completion_bash32` job is renamed `standalone_tests_bash32` and runs `KERGHAN_TEST_BASH32=1 bats standalone/test`;
  - the workflow entry and `release-kerghan-standalone`'s `requires` list use the new name.
- **Image:** `dockerfiles/bats_bash32/Dockerfile` is unchanged apart from its comments, which no longer say "completion tests" and name the new job.
- **Fixes, if any:** if anything fails under bash 3.2 by the time this is implemented, the bash-4-only construct is fixed in the client, the installer or the test helpers. The test is never skipped.
- **No static lint:** a real bash 3.2 run remains the only guard, as `client-completion.md` decides. The `BASH_VERSINFO` guard test stays in `completion_safety.bats`, skipped unless `KERGHAN_TEST_BASH32=1`.
- **Docs:** every reference to the old names or to "completion only under 3.2" is updated:
  - `docs/agents/standalone.md`: the "Client and installer tests" row;
  - `docs/agents/standalone/client-completion.md`: the "bash 3.2" testing section, where the rejected "whole suite under 3.2 … (#433)" item becomes the decision;
  - the `install_completion.bats` "bash 5 only … is #433" note;
  - the comments in `docker-compose.yml`, `.circleci/config.yml` and the Dockerfile.

  A final grep finds no `bats_bash32` service name and no `standalone_completion_bash32` outside `docs/agents/issues` and `docs/agents/plans`. The image tag `kerghan_bats_bash32` and the `dockerfiles/bats_bash32/` folder may keep their names.

## Benefits

CI tests the documented bash 3.2 (macOS) support for the whole client and installer, not just for completion. Regressions are caught in CI instead of by macOS users.
