# Issue: Run migration on Docker images

## Description
The production Docker image currently starts the NestJS server directly, without
running database migrations first. This means every deploy risks booting against
a stale or empty schema, since nothing on the deploy path (outside of local dev's
`make setup`) ever runs `yarn migration:run`.

## Problem
The production Docker image (`dockerfiles/production_kerghan/Dockerfile`) inherits
`CMD ["node", "dist/main.js"]` from `production_kerghan-base`. This means the server
starts directly without running database migrations first.

In development, `make setup` handles this separately via
`docker-compose run --rm kerghan_app yarn migration:run`. On Render (or any container
platform that just runs the image), there is no such pre-deploy step — the container
starts and the server boots against whatever schema currently exists in MySQL.

This causes the app to start with a stale or empty database schema on every deploy.

## Expected Behavior
- `yarn migration:run` executes **before** `node dist/main.js` starts the server, in
  the production image.
- Migration failure **prevents** the server from starting (fail-fast, not a silent
  boot against a broken schema).
- Works on Render (no `render.yaml` exists — the platform just builds and runs the
  Dockerfile) and on any other platform that just runs the image the same way.
- Dev/test containers (`kerghan_app`, `kerghan_tests`) are unaffected — migrations
  there stay triggered manually via `make setup`.
- No CI/CD (CircleCI) changes — CI uses mocked repositories, no live DB.
- Seed data (the demo-user seed, `20260824120004-auth-seed-demo-user.ts`) is already
  a migration and gets picked up automatically — no separate handling needed.

## Solution
Add a `dockerfiles/production_kerghan/entrypoint.sh` that runs `yarn migration:run`
then `exec node dist/main.js`, and set it as `ENTRYPOINT` in the production
Dockerfile (`dockerfiles/production_kerghan/Dockerfile`, currently no entrypoint
script exists there).

- `exec` replaces the shell with the Node process, preserving proper signal handling
  (SIGTERM from `docker stop`).
- The entrypoint checks the exit code of `yarn migration:run` and exits non-zero on
  failure, so the server never starts against a broken schema.
- Works on any container platform without platform-specific config.
- Rejected: a Render `preDeploy` hook via `render.yaml` — locks the migration step to
  Render specifically, and the project's Dockerfiles are meant to be platform-agnostic
  (no `render.yaml` exists today).
- Rejected: inlining `CMD ["sh", "-c", "yarn migration:run && node dist/main.js"]` —
  wraps the Node process in a shell, which can swallow SIGTERM, and is harder to
  extend with retry/error handling later.

### Edge cases
- **Empty database (first deploy):** TypeORM migrations create all tables from
  scratch — verify the data source connects without error when no tables exist yet.
- **Migration failure mid-deploy:** the entrypoint must check `yarn migration:run`'s
  exit code and exit non-zero on failure.
- **Concurrent deploys:** if Render runs multiple instances during a rolling deploy,
  rely on TypeORM's default `migrations` table lock row to serialize concurrent
  execution — verify this behavior, but no extra locking/mutex code is in scope.
- **Rollback:** if a deploy is rolled back, the newer migration's schema changes
  remain in the database. This is documentation-only: state that `yarn
  migration:revert` must be run manually after a rollback — no automation/tooling
  for it is in scope of this issue.

### Technical context
- **Production Dockerfile:** `dockerfiles/production_kerghan/Dockerfile` — multi-stage
  build, copies compiled `dist/` from builder, runs `yarn install --production`,
  inherits `CMD ["node", "dist/main.js"]` from `production_kerghan-base`.
- **Migrations:** TypeORM CLI, `yarn migration:run` with data source at
  `src/database/data-source.ts`. Currently 4 migration files in
  `backend/src/database/migrations/`.
- **Base image:** `dockerfiles/production_kerghan-base/Dockerfile` —
  `FROM darthjee/node:0.2.1`, sets `CMD ["node", "dist/main.js"]`.
- **Working directory:** `/home/node/app/`
- **Environment:** production expects `STAGE=production`, `KERGHAN_MYSQL_*`
  connection vars, `KERGHAN_SECRET_KEY` — all via env vars (no `.env.prod` file
  baked into the image).

### References
- `dockerfiles/production_kerghan/Dockerfile`
- `dockerfiles/production_kerghan-base/Dockerfile`
- `backend/src/database/data-source.ts`
- `backend/src/database/migrations/`
- `Makefile` (`make setup` target)
- `docs/agents/architecture/backend.md` — database strategy section
- `.claude/agents/backend.md` — migration commands

## Benefits
- Deploys never boot against a stale/empty schema — migration failures fail fast
  instead of silently corrupting runtime behavior.
- Clean separation between migration and server startup, portable across any
  container platform without platform-specific config.
- Proper signal handling preserved via `exec`, so `docker stop`/rolling deploys
  terminate the server cleanly.
