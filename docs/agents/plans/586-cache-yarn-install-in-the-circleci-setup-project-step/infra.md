# Infra Plan: Cache yarn install in the CircleCI setup_project step

Main plan: [plan.md](plan.md)

## Overview

`setup_project` in `.circleci/config.yml` runs a plain `yarn install` in every Node job, with no CircleCI cache. This plan:
- adds a required `image` parameter to the command;
- restores and saves `node_modules` under a key built from the dir, the image and `yarn.lock`;
- switches the install to `--frozen-lockfile`.

## Context

- `setup_project` callers (all in scope):
  - `yarn_project`, which `backend_tests`, `backend_checks`, `jasmine` and `frontend-checks` instantiate. It already has an `image` parameter.
  - `backend_db_tests`, with image `darthjee/circleci_kerghan-base:0.1.2`.
  - `upload_fe_files`, with image `darthjee/vite_kerghan-base:0.1.2`.
- Pre-warmed caches:
  - `circleci_kerghan-base` and `vite_kerghan-base` already pre-warm the yarn cache dir at image build time, so the yarn cache dir is **not** cached.
  - `darthjee/circleci_node` has no pre-warmed cache.
- After `Set folder`, the chosen project's files (including `yarn.lock` and `package.json`) sit at the checkout root, and `yarn install` writes `node_modules` there.

## Implementation Steps

### Step 1 — Cache node_modules in setup_project

In `.circleci/config.yml`:

1. Add a required parameter to `setup_project`:
   ```yaml
   image:
     type: string
   ```
2. Replace the `Yarn install` step with this sequence. `Set folder` stays first and unchanged.
   ```yaml
   - restore_cache:
       name: Restore node_modules cache
       keys:
         - yarn-<< parameters.dir >>-<< parameters.image >>-{{ checksum "yarn.lock" }}
   - run:
       name: Yarn install
       command: yarn install --frozen-lockfile
   - save_cache:
       name: Save node_modules cache
       key: yarn-<< parameters.dir >>-<< parameters.image >>-{{ checksum "yarn.lock" }}
       paths:
         - node_modules
   ```
   - Use exactly one key, with no prefix fallback. A changed lockfile must start from an empty `node_modules`, never from a stale one.
   - `yarn install` always runs. On a hit it is a fast integrity check. On a miss it does the full install.
3. Pass `image` from every caller:
   - `yarn_project`: `image: << parameters.image >>`.
   - `backend_db_tests`: `image: darthjee/circleci_kerghan-base:0.1.2`, the same string as its primary `docker` image.
   - `upload_fe_files`: `image: darthjee/vite_kerghan-base:0.1.2`, the same string as its primary `docker` image.
4. **Key characters:** the image strings contain `/` and `:`.
   - Validate the config with `docker-compose run --rm circleci config validate`, then `config process .circleci/config.yml`, and check the expanded keys.
   - If CircleCI rejects those characters, or they break the key in practice, add a separate `cache_key` string parameter instead. For example `circleci_kerghan-base-0.1.2`. Callers pass it alongside `image`. Note the choice in the PR.
5. Update the YAML comments:
   - Above `setup_project`: it is shared by `yarn_project`, `backend_db_tests` and `upload_fe_files`, and caches `node_modules` keyed on dir + image + `yarn.lock`.
   - Above `yarn_project`: the "checkout, keep only `dir`, yarn install" summary now includes the cache.

### Step 2 — Docs and measurement

1. Update `docs/agents/architecture/infra/ci-setup.md`, in the paragraph describing `setup_project`:
   - it is also used by `backend_db_tests`;
   - the new `image` parameter;
   - the `node_modules` cache key and its no-fallback rule;
   - `yarn install --frozen-lockfile`, and that an out-of-sync `yarn.lock` now fails CI.
2. Measure in CI:
   - The first push on the branch is a cold run: every key misses and gets saved, and all jobs must pass.
   - The second push (or a rerun) should hit.
   - Record the `Yarn install` duration per job, for cold and warm runs, against a recent `main` run as the baseline. Put the table in the PR description.

## Files to Change

- `.circleci/config.yml`: the `image` parameter on `setup_project`, `restore_cache` / `save_cache` around `yarn install --frozen-lockfile`, `image` passed from `yarn_project`, `backend_db_tests` and `upload_fe_files`, and updated comments.
- `docs/agents/architecture/infra/ci-setup.md`: the `setup_project` description (cache, `image` parameter, frozen lockfile, `backend_db_tests` as a caller).

## CI Checks

- `.circleci/`: `docker-compose run --rm circleci config validate` (validates the whole pipeline config).
- All jobs that use `setup_project`: `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `backend_db_tests`. `upload_fe_files` runs only on tag pushes, so it is checked through `config process`, not a live run.

## Notes

- `save_cache` is a no-op when the key already exists, because CircleCI caches are immutable. That is fine, since the key changes whenever `yarn.lock` changes.
- `--frozen-lockfile` could fail CI if a committed `yarn.lock` is already out of sync. If the cold run fails at `Yarn install` for that reason, regenerate the lockfile through `docker-compose`, never yarn on the host, and commit it in this PR.
- `upload_fe_files` cannot be exercised before a release tag. Its config is validated statically only.
- Out of scope: base images and their pre-warmed yarn cache, and the other #582 work.
