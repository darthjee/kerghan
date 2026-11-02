# Standalone Plan: Standalone: run the whole bats suite under bash 3.2

Main plan: [plan.md](plan.md)

## Shared contracts

Rely on infra producing:

- the docker-compose service `standalone_tests_bash32`, run with `docker-compose run --rm standalone_tests_bash32`;
- the CircleCI job `standalone_tests_bash32`.

Both run the whole `standalone/test` suite with `KERGHAN_TEST_BASH32=1`. The docs below must use exactly these names.

## Implementation Steps

### Step 1 — Fix anything that fails under bash 3.2 (expected: nothing)
Run `docker-compose run --rm standalone_tests_bash32` after infra's change.

- **Expected:** it passes, as it did on main at fde5226 (475 ok). Then this step changes nothing.
- **If a test fails:** fix the bash-4-only construct in `standalone/bin/kerghan`, `standalone/install.sh` or `standalone/test/helpers/` (or a stub). Never skip the test, never make it conditional on the bash version, and never weaken it. The bash 5 run must still pass.

The existing skips stay as they are:

- `command_not_found_handle`, which needs bash 4;
- the root read-only-dir test;
- the `dockerfiles/`-not-mounted test.

### Step 2 — Update the docs
- **`docs/agents/standalone.md`, the "Client and installer tests" row:** replace "The `completion*.bats` files also run under bash 3.2: `docker-compose run --rm bats_bash32`, in CI job `standalone_completion_bash32`." with a sentence saying the whole suite also runs under bash 3.2 (the version macOS ships): `docker-compose run --rm standalone_tests_bash32`, in CI job `standalone_tests_bash32`.
- **`docs/agents/standalone/client-completion.md`, the "bash 3.2" testing section:**
  - say the whole standalone suite runs under a real bash 3.2, including completion. Update the docker-compose bullet (`standalone_tests_bash32` runs `standalone/test`) and the CircleCI bullet (`standalone_tests_bash32`, the same suite as `standalone_tests`, on 3.2);
  - remove the rejected "The whole suite under 3.2 … tracked separately (#433)" item. Keep the rejected static lint, reworded to "redundant once the whole suite runs under 3.2";
  - reword or remove the sentence in "File layout" that ties the bash 3.2 service to the `completion*.bats` glob.
- **`client-completion.md`, the `install_completion.bats` "Required tests" intro:** replace "runs on bash 5 only: running `install.sh` under bash 3.2 is #433" with "runs under bash 5 and bash 3.2, like the whole suite". Also check the line near "every case in this file also runs in the bash 3.2 service", which stays true.
- **Grep for leftovers:** `grep -rn 'bats_bash32\|standalone_completion_bash32\|#433' docs/agents --include=*.md`, ignoring `docs/agents/issues/` and `docs/agents/plans/`. Fix every remaining reference to the old service or job name, or to #433 as future work. The `dockerfiles/bats_bash32` folder path and the `kerghan_bats_bash32` image tag may stay.

## Files to Change
- `docs/agents/standalone.md`: the "Client and installer tests" row.
- `docs/agents/standalone/client-completion.md`: the "bash 3.2" section, "File layout", and the `install_completion.bats` tests intro.
- `standalone/bin/kerghan`, `standalone/install.sh`, `standalone/test/**`: only if Step 1 finds a failure.

## CI Checks
- `standalone/`, on bash 3.2: `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`).
- `standalone/`, on bash 5: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`).

## Notes
- The client's bash 3.2 rule in its header comment (`standalone/bin/kerghan`, around line 18) already covers the whole client, so it doesn't change.
- `docs/agents/standalone.md` already states "bash 3.2 or later" for the client. The wording doesn't change; it is now tested.
