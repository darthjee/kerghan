# Plan: Deploy frontend

Issue: [11-deploy-frontend.md](../../issues/11-deploy-frontend.md)

## Overview

Wire a tag-gated CircleCI release chain into `.circleci/config.yml`: build and upload the
frontend, upload the Tent proxy (runtime, config, extension) over SSH, and deploy the backend
to Render — with the atomic frontend/proxy swap (`release`) held back until the backend deploy
is confirmed `live`. All job bodies reuse existing scripts (`bin/deploy_frontend.sh`,
`scripts/deploy.sh`, `scripts/render.sh`) verbatim — no script changes. Also clean up every
dangling `aux/`/`.circleci/config.yml.bkp` reference in the repo, since that folder never
existed here and is being deleted from where it did exist (a separate local checkout).

Single-agent plan (**infra**) — no other specialist agent (`frontend`, `proxy`, `cache`,
`data-access`, `product-owner`, `security`) has file changes here: nothing in `proxy/` or
`frontend/` is modified, only uploaded as-is by new CI jobs, and no cache-warmer, endpoint, or
auth-logic changes are involved.

## Context

`.circleci/config.yml` currently only runs tests/lint (`backend_tests`, `backend_checks`,
`jasmine`, `frontend-checks`, `proxy_extension_tests`) and base-image publishing
(`release-image`). The deploy scripts it needs already exist and are fully unused by CI:
`bin/deploy_frontend.sh` (build/upload/link/release primitives over SSH, workflow-scoped temp
dir, atomic `mv` swap) and `scripts/deploy.sh`/`scripts/render.sh` (Render backend deploy).

Three comments in `.circleci/config.yml` (lines 50-52, 86, 132-133) and one in
`.claude/agents/infra.md` (line 45) point at `.circleci/config.yml.bkp` / `aux/todo.md` /
`aux/base-image.md` — none of which have ever existed in this repo. `docs/agents/
environment-variables.md` §4 has the same problem (`aux/circleci_config.yml`, `aux/todo.md`)
plus an now-to-be-false claim that the live config needs none of the listed CircleCI project
variables. Full detail and the exact rationale for every decision below (atomicity, `.htaccess`
carry-over, deferred tag-race guard, accepted `StrictHostKeyChecking=no` risk, etc.) is in the
issue file — this plan doesn't repeat the "why", only the "what to change".

No real Render service / SSH host exists yet for Kerghan — provisioning that and setting the
actual CircleCI project variables is explicitly out of scope; this plan only delivers pipeline
code that will run for real once the repo owner provisions that infrastructure separately.

## Implementation Steps

### Step 1 — Add the release-chain jobs to the `test` workflow

In `.circleci/config.yml`, under `workflows.test.jobs`, add six new job entries (after the
existing `proxy_extension_tests` entry and before the `release-image` entries, or wherever
reads cleanly — order among siblings doesn't affect the dependency graph). Introduce a
`&tags_only` anchor on the first of them and reuse it via `*tags_only` on the rest, matching
the tag-filter shape already used ad hoc for `release-image` (`filters: { tags: { only: /.*/ }
}`) but scoped to semver tags only and excluding all branches:

```yaml
      - build-and-release:
          requires: [backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]
          filters: &tags_only
            tags:
              only: /\d+\.\d+\.\d+/
            branches:
              ignore: /.*/
      - upload_proxy_files:
          requires: [backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]
          filters: *tags_only
      - upload_fe_files:
          requires:
            - backend_tests
            - backend_checks
            - jasmine
            - frontend-checks
            - proxy_extension_tests
            - release-vite_kerghan-base
            - release-vite_kerghan-base-arm64
          filters: *tags_only
      - upload_extension:
          requires: [upload_proxy_files]
          filters: *tags_only
      - copy_proxy_configuration:
          requires: [upload_proxy_files]
          filters: *tags_only
      - release:
          requires:
            - build-and-release
            - upload_extension
            - upload_proxy_files
            - copy_proxy_configuration
            - upload_fe_files
            - release-vite_kerghan-base
            - release-vite_kerghan-base-arm64
          filters: *tags_only
```

`release-vite_kerghan-base`/`release-vite_kerghan-base-arm64` are the existing `release-image`
workflow entries (lines 40-48) — reused, not duplicated.

### Step 2 — Add the six new job definitions

Under the top-level `jobs:` key, add:

```yaml
  build-and-release:
    machine: true
    steps:
      - checkout
      - run:
          name: Update Render Deploy Branch
          command: scripts/deploy.sh update_deploy_branch
      - run:
          name: Trigger Deploy
          command: scripts/deploy.sh deploy

  upload_proxy_files:
    docker:
      - image: darthjee/tent:0.10.1
    working_directory: /home/app/app
    steps:
      - checkout
      - run:
          name: Generate key file
          command: bin/deploy_frontend.sh generate_key_file
      - run:
          name: Upload proxy files
          command: SOURCE=/var/www/html/ bin/deploy_frontend.sh upload

  copy_proxy_configuration:
    docker:
      - image: darthjee/tent:0.10.1
    working_directory: /home/app/app
    steps:
      - checkout
      - run:
          name: Generate key file
          command: bin/deploy_frontend.sh generate_key_file
      - run:
          name: Upload proxy configuration
          command: SOURCE=proxy/prod_configuration/ DEPLOY_PATH=configuration/ bin/deploy_frontend.sh upload
      - run:
          name: Setup locals
          command: TARGET=configuration/locals.php DEPLOY_PATH=configuration/ bin/deploy_frontend.sh copy_files
      - run:
          name: Setup .htaccess
          command: TARGET=.htaccess DEPLOY_PATH=./ bin/deploy_frontend.sh copy_files

  upload_extension:
    docker:
      - image: darthjee/tent:0.10.1
    working_directory: /home/app/app
    steps:
      - checkout
      - run:
          name: Generate key file
          command: bin/deploy_frontend.sh generate_key_file
      - run:
          name: Remove test files
          command: rm -rf proxy/extension/tests/
      - run:
          name: Upload proxy extension
          command: SOURCE=proxy/extension/ DEPLOY_PATH=extension/ bin/deploy_frontend.sh upload

  upload_fe_files:
    docker:
      - image: darthjee/vite_kerghan-base:0.1.0
    steps:
      - checkout
      - run:
          name: Set folder
          command: rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
      - run:
          name: Yarn install
          command: yarn install
      - run:
          name: Build assets
          command: bin/deploy_frontend.sh build
      - run:
          name: Generate key file
          command: bin/deploy_frontend.sh generate_key_file
      - run:
          name: Generate folder
          command: DEPLOY_PATH=static/ bin/deploy_frontend.sh generate_folder
      - run:
          name: Upload assets
          command: SOURCE=dist/ DEPLOY_PATH=static/ bin/deploy_frontend.sh upload

  release:
    docker:
      - image: darthjee/vite_kerghan-base:0.1.0
    steps:
      - checkout
      - run:
          name: Generate key file
          command: bin/deploy_frontend.sh generate_key_file
      - run:
          name: Release assets
          command: bin/deploy_frontend.sh release
```

No changes to `bin/deploy_frontend.sh`, `scripts/deploy.sh`, or `scripts/render.sh` — every
action called above (`generate_key_file`, `upload`, `copy_files`, `generate_folder`, `release`,
`update_deploy_branch`, `deploy`) is already implemented by them.

Do **not** add `warm-up-cache`/`wake-navi` jobs — cache warm-up is explicitly out of scope for
this issue (separate future issue).

### Step 3 — Clean up dead `aux/`/`.bkp` references

- `.circleci/config.yml:50-52` (comment above `backend_tests`): replace the
  "`.circleci/config.yml.bkp`... `aux/todo.md`" sentence — the release chain now lives in this
  same file (Steps 1-2), so just say so instead of pointing at a nonexistent backup file. Keep
  the "No DB service container yet" paragraph below it unchanged.
- `.circleci/config.yml:86` (comment above `jasmine`): drop the `aux/todo.md` reference from the
  i18n note — keep the substance ("no i18n layer, optional, skipped for now"), just remove the
  dead file pointer.
- `.circleci/config.yml:132-133` (comment above `release-image`): drop the `aux/base-image.md`
  reference — keep "mirrors Majora's `release-image` pattern", just remove the dead pointer.
- `.claude/agents/infra.md:45`: same fix — remove the `aux/base-image.md` pointer from the
  "Backend image publishing" section, keep the surrounding sentence about mirroring Majora's
  pattern.

### Step 4 — Update the environment-variables doc

In `docs/agents/environment-variables.md` §4 ("CircleCI project variables"):

- Rewrite the intro paragraph: it currently says the live config "is a trimmed test/lint-only
  pipeline and needs none of these" and points at `aux/circleci_config.yml`/`aux/todo.md` for
  the "full release chain" — after this issue, the release chain is live in
  `.circleci/config.yml` itself, so update the paragraph to say these variables are now
  required by the jobs added in Steps 1-2, and drop both `aux/` pointers.
- Keep the variable table rows as-is for `DOCKER_ID_USER`, `DOCKER_HUB_USERNAME`,
  `DOCKER_HUB_PASSWORD` (already used by the pre-existing `release-image` jobs), `RENDER_API_KEY`,
  `RENDER_SERVICE_NAME`, `SSH_PRIVATE_KEY`, `SSH_HOST`/`SSH_PORT`/`SSH_USER`, `SSH_REMOTE_DIR`,
  `SSH_REMOTE_TEMP_DIR` — these are all consumed by the new jobs from Step 2 and the row
  descriptions are already accurate.
- Fix the `KERGHAN_NAMESPACE` row: it currently cites `aux/circleci_config.yml`'s
  `warm-up-cache` job. Since that job isn't part of this issue, reword to note it's for a
  not-yet-implemented `warm-up-cache` job (future issue), without the `aux/` pointer. Leave
  `NAVI_URL`/`NAVI_API_TOKEN` rows as-is (still correctly described as used by
  `scripts/warm_navi_cache.sh`/`scripts/wake_navi.sh`, which already exist and are unaffected by
  this issue).

## Files to Change

- `.circleci/config.yml` — add 6 new workflow jobs + definitions (Steps 1-2); fix 3 dead-`aux/`
  comments (Step 3).
- `.claude/agents/infra.md` — fix 1 dead-`aux/base-image.md` reference (Step 3).
- `docs/agents/environment-variables.md` — update §4 intro + `KERGHAN_NAMESPACE` row (Step 4).

## CI Checks

- Repo root: `circleci config validate` (CircleCI CLI is available locally) — validates
  `.circleci/config.yml` YAML/schema correctness, including the new anchor/jobs, without needing
  real secrets or triggering an actual build.
- The pre-existing gating jobs (`backend_tests`, `backend_checks`, `jasmine`,
  `frontend-checks`, `proxy_extension_tests`) are unchanged by this issue and continue to run
  the same way; no new local test command is introduced since the new jobs are deploy-only
  (nothing to unit-test — they call already-covered shell scripts).

## Notes

- This pipeline cannot be exercised end-to-end (a real tag push) until the repo owner
  provisions the Render service, SSH host, and the CircleCI project variables listed in Step 4
  — that provisioning is explicitly out of scope for this issue (see the issue's
  "Infrastructure" section).
- Aside, not part of this issue's scope: `docs/agents/environment-variables.md`'s
  `CODACY_PROJECT_TOKEN` row claims it's read by `backend_tests`/`jasmine`, but the current live
  versions of those jobs have no Codacy upload step at all (only the historical `aux/` blueprint
  did). Flagging in case it's worth a follow-up doc fix later — not touched here to stay within
  this issue's agreed scope (only the `aux/`/`.bkp` references discussed in the issue).
- Accepted risks/deferred work carried over unchanged from the issue (no action needed in this
  plan): `StrictHostKeyChecking=no` on SSH calls, partial-failure risk in `run_release`'s
  chained `mv`, no approval gate before a tag-triggered production release, and no guard against
  concurrent/out-of-order tag releases.
