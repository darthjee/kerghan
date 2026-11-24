# Issue: Cache yarn install in the CircleCI setup_project step

## Description
Part of #582. Add a dependency cache to the shared `setup_project` command in `.circleci/config.yml`, so the `Yarn install` step is faster in every job that uses it, and make that install fail when `yarn.lock` is out of sync.

### Scope
In scope, every job that uses `setup_project`:
- `yarn_project` instances: `backend_tests`, `backend_checks` (image `darthjee/circleci_kerghan-base`), `jasmine`, `frontend-checks` (image `darthjee/circleci_node`).
- `backend_db_tests` (`circleci_kerghan-base`).
- `upload_fe_files` (`vite_kerghan-base`, release job). It runs only on tag pushes, so it will hit the cache less often. It is still covered, because it shares the command and gets the new parameter anyway.

Out of scope:
- Changing the base images or their pre-warmed yarn cache.
- Other CI speedups from #582 (DB tier, MySQL tuning, resource classes).

## Problem
`setup_project` runs `yarn install` on every job with no CircleCI cache. It is a separate step from the test step, so it does not change that step's duration, but it adds to each job's total time.

The images differ:
- `circleci_kerghan-base` and `vite_kerghan-base` already pre-warm the yarn cache (`~/.cache/yarn/v6`) from `yarn.lock` at image build time. On these, `yarn install` mostly links `node_modules`, and downloads only packages added since the image was built.
- `darthjee/circleci_node` (frontend test/lint jobs) has no pre-warmed cache, so every frontend job downloads everything.

`yarn install` also runs without `--frozen-lockfile`, so a `yarn.lock` that is out of sync with `package.json` is silently re-resolved in CI instead of failing.

## Expected Behavior
- On a cache hit, the `Yarn install` step is visibly shorter in CI.
- On a cache miss (cold cache, or a changed `yarn.lock`), `yarn install` still runs and succeeds.
- Backend and frontend never share a cache entry, and neither do different images.
- CI fails at `Yarn install` when `yarn.lock` does not match `package.json`.

## Solution
- **What is cached:** `node_modules` at the checkout root, which skips both download and linking on a hit. The yarn cache dir is not cached, since two of the three images already pre-warm it.
- **Image parameter:** add a required `image` string parameter to `setup_project`.
  - `yarn_project` passes `<< parameters.image >>`.
  - `backend_db_tests` and `upload_fe_files` pass their own image strings.
  - The image is part of the key, so an image bump never reuses `node_modules` built against another image (native modules, Node version).
- **Steps in `setup_project`:**
  1. `Set folder` (unchanged). Afterwards, the project's `yarn.lock` sits at the checkout root.
  2. `restore_cache` with key `yarn-<< parameters.dir >>-<< parameters.image >>-{{ checksum "yarn.lock" }}`. There is no prefix fallback key, so a changed lockfile starts from an empty `node_modules` and never from a stale one.
  3. `yarn install --frozen-lockfile`, always run. On a hit it is a fast integrity check. On a miss it does the full install.
  4. `save_cache` with the same key, path `node_modules`.
- **Key characters:** the image string contains `/` and `:` (for example `darthjee/circleci_node:0.2.1`). Check that CircleCI accepts them in a cache key. If it does not, pass a sanitized cache-key parameter instead.
- **Docs:** update the comments above `setup_project` and `yarn_project`, and `docs/agents/architecture/infra/ci-setup.md`, which describes `setup_project`.

### Testing
- Push twice. The first run is a miss and saves the cache. The second is a hit. Compare the `Yarn install` timings per job, and put before/after timings in the PR description.
- Confirm that a cold run (new key) still passes every job.

## Benefits
- Shorter total time for every Node job in CI.
- Biggest gain on the frontend jobs, whose image has no pre-warmed cache.
- A stale or missing `yarn.lock` update is caught in CI instead of being silently re-resolved.
