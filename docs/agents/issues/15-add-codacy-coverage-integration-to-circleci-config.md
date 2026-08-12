# Add Codacy coverage integration to CircleCI config

## Context

Majora uploads test coverage to Codacy as part of its CircleCI pipeline: every test job that
produces coverage output uploads it as a partial report right after running (`bash <(curl -Ls
https://coverage.codacy.com/get.sh) report --partial -r coverage/lcov.info`), and a dedicated
`coverage-final` job — which requires all the test jobs — finalizes the aggregated report (`bash
<(curl -Ls https://coverage.codacy.com/get.sh) final`).

Kerghan's `.circleci/config.yml` has no equivalent. The `backend_tests` and `jasmine` jobs
already run `npm run coverage` and produce coverage output, but that output is never uploaded to
Codacy, and there is no `coverage-final` job in the workflow at all. As a result, Kerghan gets no
Codacy coverage reporting even though the underlying test jobs already generate the data Codacy
needs.

## What needs to be done

Infra: update `.circleci/config.yml` to mirror Majora's Codacy coverage pattern.

- In the `backend_tests` job, add a step after `npm run coverage` that uploads the partial
  coverage report to Codacy: `bash <(curl -Ls https://coverage.codacy.com/get.sh) report
  --partial -r coverage/lcov.info` (confirm the actual lcov output path/filename produced by
  Kerghan's backend coverage command and adjust `-r` accordingly if it differs from Majora's).
- In the `jasmine` job, add the equivalent partial-coverage upload step after `npm run coverage`,
  pointing `-r` at the lcov file produced by the frontend's coverage command.
- Add a new `coverage-final` job that runs `bash <(curl -Ls https://coverage.codacy.com/get.sh)
  final`, following Majora's job definition.
- Wire `coverage-final` into the `test` workflow with `requires: [backend_tests, jasmine]` (or
  the full set of coverage-producing jobs), matching how Majora's `coverage-final` job requires
  all of its test jobs.
- Confirm whether a `CODACY_PROJECT_TOKEN` (or equivalent) CircleCI environment variable/context
  is already configured for Kerghan's project, the same way Majora's is — the `get.sh` upload
  script needs it to authenticate. Document any manual dashboard configuration needed if it
  isn't set yet.
- Update `docs/agents/architecture.md` (or the relevant CircleCI architecture doc) if Kerghan's
  CI docs describe the current test-job coverage behavior, so the new Codacy steps are reflected.

## Acceptance criteria

- [ ] `backend_tests` uploads a partial Codacy coverage report after `npm run coverage` succeeds.
- [ ] `jasmine` uploads a partial Codacy coverage report after `npm run coverage` succeeds.
- [ ] A `coverage-final` job exists, runs the Codacy `final` command, and is required by (depends
      on) the coverage-producing test jobs in the `test` workflow.
- [ ] CircleCI has the Codacy project token available to the jobs that need it (verified or
      flagged as a follow-up if it needs to be added out-of-band via the CircleCI dashboard).
- [ ] `.circleci/config.yml` remains valid (parses/lints cleanly) after the change.
