# Infra Plan: Per-worker test schemas and drop --runInBand in the DB tier

Main plan: [plan.md](plan.md)

## Shared contracts

- Provide `KERGHAN_MYSQL_ADMIN_USER=root` and `KERGHAN_MYSQL_ADMIN_PASSWORD=kerghan` to the DB-tier runner in compose and CI. `kerghan` matches the MySQL containers' `MYSQL_ROOT_PASSWORD`, and the image creates `root@'%'` by default.
- Keep `KERGHAN_MYSQL_NAME=kerghan_test` (now the base name) and the other `KERGHAN_MYSQL_*` values unchanged. Keep the MySQL containers' `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` unchanged.
- Run the tier as `npm run test:db -- --maxWorkers=<n>` in CI. The backend's `jest.db.config.ts` defaults to 2.

## Implementation Steps

### Step 1 — Compose
Add `KERGHAN_MYSQL_ADMIN_USER=root` and `KERGHAN_MYSQL_ADMIN_PASSWORD=kerghan` to the `kerghan_db_tests` service's `environment`, and update the comment above it to say the tier creates per-worker schemas through the admin connection. `kerghan_mysql_test` is unchanged: it keeps tmpfs and no published port. A container that's already running keeps working, because `globalSetup` applies the grant on every run.

### Step 2 — CircleCI `backend_db_tests` and measurement
- Add the same two admin env vars to the primary container's `environment` in `backend_db_tests`.
- Change the step command to `npm run test:db -- --maxWorkers=2` and update the job's header comment (per-worker schemas, why the worker count is fixed).
- **Before:** record the `DB tests` step duration from the last 3 `backend_db_tests` runs on `main` (CircleCI UI or API).
- **After, medium:** with no `resource_class` (the medium default), run the job 3 times on the PR (the first run plus 2 reruns) and record each step duration plus the `globalSetup` timing lines.
- **After, `large`:** temporarily set `resource_class: large` and `--maxWorkers=4` (try 3 as well if 4 hits connection or CPU limits), and run it 3 times again.
- Keep `large` only if the gain justifies the extra credits; otherwise revert to medium with `--maxWorkers=2`. Write the before/after table and the reasoning in the PR description.
- Update `docs/agents/architecture/infra/ci-jobs.md` for `backend_db_tests`: the admin env vars, the `--maxWorkers` value, the chosen resource class and why.

## Files to Change
- `docker-compose.yml`: `kerghan_db_tests` admin env vars and comment.
- `.circleci/config.yml`: `backend_db_tests` admin env vars, `--maxWorkers`, the final `resource_class`, comment.
- `docs/agents/architecture/infra/ci-jobs.md`: the `backend_db_tests` entry.

## CI Checks
- `.circleci/config.yml`: `circleci config validate` if the CLI is available in a container; otherwise rely on the pipeline itself (CI job: `backend_db_tests`).
- `backend`: `docker-compose run --rm kerghan_db_tests` (CI job: `backend_db_tests`).

## Notes
- The admin password is a throwaway test value that's already in both configs as `MYSQL_ROOT_PASSWORD`; it isn't a new secret.
- CircleCI `parallelism` (splitting files across containers) is out of scope. It's a deferred follow-up, to be reconsidered with these numbers.
