# Plan: Add Codacy coverage integration to CircleCI config

Issue: [15-add-codacy-coverage-integration-to-circleci-config.md](../../issues/15-add-codacy-coverage-integration-to-circleci-config.md)

## Overview

Mirror Majora's Codacy coverage pattern in Kerghan's `.circleci/config.yml`: upload a partial
coverage report from `backend_tests` and `jasmine` right after `npm run coverage`, add a new
`coverage-final` job that finalizes the aggregated report, and wire it into the `test` workflow
requiring both coverage-producing jobs.

## Context

Both `backend_tests` (`backend/package.json`) and `jasmine` (`frontend/package.json`) already run
`npm run coverage`, which is `npx c8 --reporter=lcov jasmine "<spec-glob>"`. c8's default output
directory is `coverage/`, and the `lcov` reporter writes `coverage/lcov.info` — so both jobs
already produce `coverage/lcov.info` at their respective (copied-to-root) working directories,
matching the path Majora's own upload step uses. No coverage-command changes are needed, only new
CI steps that consume the existing output.

`docs/agents/environment-variables.md` §4 already documents `CODACY_PROJECT_TOKEN` as "Coverage
upload target, read implicitly by Codacy's own uploader script" — used by `backend_tests`/
`jasmine`. This confirms the token is the expected project variable for this integration; whether
it is actually set in CircleCI's project settings is outside this repo's tracked state (same
"provisioning is a separate, not-yet-done step" caveat already noted for the other deploy
variables in that doc) — flag it as a follow-up rather than blocking the change on it.

## Implementation Steps

### Step 1 — Upload partial coverage from `backend_tests`

Add a step after the existing `Tests` step (`npm run coverage`) in the `backend_tests` job:

```yaml
- run:
    name: Upload coverage to Codacy
    command: bash <(curl -Ls https://coverage.codacy.com/get.sh) report --partial -r coverage/lcov.info
```

### Step 2 — Upload partial coverage from `jasmine`

Add the equivalent step after `jasmine`'s existing `Tests` step, same command (frontend's
`npm run coverage` also writes `coverage/lcov.info` once copied to the job's working directory).

### Step 3 — Add the `coverage-final` job

Add a new job, modeled on Majora's, that finalizes the aggregated Codacy report:

```yaml
coverage-final:
  docker:
    - image: darthjee/circleci_kerghan-base:0.1.0
  steps:
    - run:
        name: Finalize Codacy coverage
        command: bash <(curl -Ls https://coverage.codacy.com/get.sh) final
```

The `get.sh` script only needs `bash`/`curl`, so any existing lightweight image works — reuse
`darthjee/circleci_kerghan-base:0.1.0` (already used by `backend_tests`/`backend_checks`) rather
than introducing a new image dependency. No checkout is needed since the job doesn't touch
repository files, only calls the Codacy API.

### Step 4 — Wire `coverage-final` into the `test` workflow

In the `workflows.test.jobs` list, add:

```yaml
- coverage-final:
    requires: [backend_tests, jasmine]
    filters: *all_tags
```

Use the same `*all_tags` filter anchor already applied to the other test/lint jobs, so
`coverage-final` runs on every push (including tag pushes), consistent with the rest of the
non-release-chain jobs.

### Step 5 — Update the infra architecture doc

Update `docs/agents/architecture/infra.md`:
- Add `coverage-final` to the job graph diagram (fed by `backend_tests` and `jasmine`, parallel
  to `build-and-release`/`upload_proxy_files`/`upload_fe_files` — it does not gate the release
  chain, since it isn't in any of their `requires` lists).
- Add a `coverage-final` row to the "CI jobs" table (`darthjee/circleci_kerghan-base:0.1.0`,
  every push, "Finalizes the aggregated Codacy coverage report").
- Note in the `backend_tests`/`jasmine` rows (or in prose nearby) that they now also upload a
  partial Codacy coverage report after their test step.

## Files to Change

- `.circleci/config.yml` — add the two partial-upload steps, the `coverage-final` job, and its
  workflow entry.
- `docs/agents/architecture/infra.md` — document the new job and the partial-upload steps.

## CI Checks

- `.circleci/config.yml`: no local command runs CircleCI's own YAML parsing; sanity-check by
  running `docker-compose run --rm kerghan_tests circleci config validate` if the CLI is
  available in that service, otherwise rely on CircleCI itself validating the config on push (the
  `test` workflow's existing jobs, e.g. `backend_checks`: `docker-compose run --rm kerghan_be
  yarn lint`, are unaffected by this change and don't need re-running for this specific edit).

## Notes

- `CODACY_PROJECT_TOKEN` being set in CircleCI's actual project settings cannot be verified from
  this repo — `docs/agents/environment-variables.md` already documents it as required by
  `backend_tests`/`jasmine`; this plan does not change that doc's claim, only makes the config
  match it. If the token turns out not to be provisioned yet, the new upload steps will fail at
  runtime the same way the rest of the (also unprovisioned) deploy-chain variables already do —
  this is a known, already-accepted state for Kerghan's CircleCI setup, not a regression
  introduced here.
- No test job command changes — only new steps consuming the coverage output the jobs already
  produce.
