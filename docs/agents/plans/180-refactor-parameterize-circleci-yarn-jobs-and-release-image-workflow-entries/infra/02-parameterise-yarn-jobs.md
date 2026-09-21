# Parameterise the yarn jobs
In `.circleci/config.yml`:

1. Add a top-level `commands:` section with a `setup_project` command taking a `dir` parameter (`backend` | `frontend`). It must reproduce today's "Set folder" behaviour exactly — remove the *other* folder, copy `<dir>/*` into the checkout root, remove `<dir>` — followed by the `yarn install` step (keep the step names `Set folder` / `Yarn install`).
2. Add a `yarn_project` job with parameters `dir`, `image`, `script` and `upload_coverage` (boolean, default `false`). Body: `docker: - image: << parameters.image >>`, `checkout`, `setup_project` with `dir`, a `run` step (`name: Tests` for coverage / `Check JS Lint` for lint — either parameterise the step name or pick a neutral name and keep it consistent) executing `npm run << parameters.script >>`, and a `when: condition: << parameters.upload_coverage >>` step running the existing Codacy upload command (`bash <(curl -Ls https://coverage.codacy.com/get.sh) report --partial -r coverage/lcov.info || true`).
3. Delete the four old job definitions (`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`) and replace their workflow entries with `yarn_project` invocations that set `name:` to the *existing* names, so all `requires:` entries stay valid:
   - `backend_tests`: `dir: backend`, image `darthjee/circleci_kerghan-base:0.1.0`, `script: coverage`, `upload_coverage: true`, keeping `requires: [release-circleci_kerghan-base, release-circleci_kerghan-base-arm64]` and `filters: &all_tags`.
   - `backend_checks`: `dir: backend`, same image, `script: lint`, same `requires`/`filters: *all_tags`.
   - `jasmine`: `dir: frontend`, image `darthjee/circleci_node:0.2.1`, `script: coverage`, `upload_coverage: true`, `filters: *all_tags`.
   - `frontend-checks`: `dir: frontend`, same image, `script: lint`, `filters: *all_tags`.
4. Make `upload_fe_files` use `setup_project` (with `dir: frontend`) in place of its own `Set folder` + `Yarn install` steps; leave its remaining steps untouched.
5. Preserve the existing explanatory comments (no DB service container note, no `check_i18n` note) — move them next to the workflow entries / job as appropriate.

## Files to Change
- `.circleci/config.yml` — add `commands:`/`setup_project`, add `yarn_project` job, delete the four duplicated jobs, convert their workflow entries, use `setup_project` in `upload_fe_files`.
