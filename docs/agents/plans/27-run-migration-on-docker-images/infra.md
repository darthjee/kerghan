# Infra Plan: Run migration on Docker images

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add the production entrypoint script
Create `dockerfiles/production_kerghan/entrypoint.sh`. It must:
- Run `yarn migration:run` first.
- Check its exit code and `exit` non-zero immediately if it failed (fail-fast —
  the server must never start against a broken/partial schema).
- On success, `exec node dist/main.js` — `exec` (not a plain call) so the Node
  process replaces the shell as PID 1 and receives `SIGTERM`/`SIGINT` directly
  from `docker stop` / Render's rolling restarts, instead of the shell
  swallowing them.
- Start with `#!/bin/sh` (the base image doesn't guarantee `bash` is present in
  the final production stage) and `set -e` so any unexpected failure before the
  explicit migration check still aborts instead of falling through.
- Be executable (`chmod +x`) — the file mode has to survive `COPY` in Step 2
  (Docker preserves the source file's executable bit, but confirm after
  building).

### Step 2 — Wire the entrypoint into the production Dockerfile
Edit `dockerfiles/production_kerghan/Dockerfile` (final image stage, after the
existing `RUN yarn install --production`):
- `COPY --chown=node:node ./dockerfiles/production_kerghan/entrypoint.sh /home/node/app/entrypoint.sh`
  (adjust the source path if the build context differs — verify against how the
  Dockerfile is actually invoked, e.g. `docker build -f
  dockerfiles/production_kerghan/Dockerfile .` from repo root vs. some other
  context).
- `ENTRYPOINT ["/home/node/app/entrypoint.sh"]` — this overrides the inherited
  `CMD ["node", "dist/main.js"]` from `production_kerghan-base` for this image
  (Docker still runs the base's `CMD` as the entrypoint's arguments if no local
  `CMD` is set, but the entrypoint script here ignores `$@` and calls `node
  dist/main.js` directly, so this is safe either way — do not rely on `$@`
  matching the base `CMD` staying in sync).
- Keep `USER node` before this so the entrypoint runs as the non-root `node`
  user, matching the rest of the image.

### Step 3 — Verify migration behavior end-to-end, then document it
Before considering this done, build the production image locally and check:
- **Empty database (first deploy):** run the container against a fresh MySQL
  instance with no tables — confirm `yarn migration:run` creates all 4
  migrations' tables and the server then starts normally.
- **Migration failure:** temporarily break a migration (or point at
  unreachable `KERGHAN_MYSQL_*` vars) and confirm the container exits non-zero
  and `node dist/main.js` never runs.
- **Concurrency:** this issue relies on TypeORM's default `migrations` table
  lock row to serialize concurrent runs across rolling-deploy instances — no
  extra locking code is in scope, but confirm (by reading TypeORM's migration
  runner behavior, or a quick two-instance test) that a second concurrent
  `yarn migration:run` genuinely blocks/no-ops rather than racing.

Then add a short section to `docs/agents/architecture/infra.md` documenting:
- That the production image now runs migrations via `entrypoint.sh` before
  starting the server, and a migration failure prevents the server from
  starting.
- The rollback policy: this issue does **not** add automated revert tooling —
  if a deploy is rolled back, the newer migration's schema changes remain in
  the database, and `yarn migration:revert` must be run manually (e.g. via a
  one-off shell against the running container or a local `KERGHAN_MYSQL_*`
  connection) if reverting the schema is actually needed.

## Files to Change
- `dockerfiles/production_kerghan/entrypoint.sh` — new; runs migrations then
  execs the server, fails fast on migration error.
- `dockerfiles/production_kerghan/Dockerfile` — copies the entrypoint script
  in and sets it as `ENTRYPOINT`.
- `docs/agents/architecture/infra.md` — documents the migration-on-boot
  behavior and the manual-revert rollback policy.

## Notes
- No CircleCI job builds/tests `dockerfiles/production_kerghan/Dockerfile`
  itself (only `production_kerghan-base` has a `release-image` job; Render
  builds `production_kerghan` directly from the Dockerfile on deploy) — so
  there's no local command to run against CI here, and no `## CI Checks`
  section applies. Verification is the manual steps in Step 3 above.
- Dev/test containers (`kerghan_app`, `kerghan_tests`) and `make setup` are
  unchanged — they keep running migrations manually, per the issue's scope.
- The demo-user seed migration (`20260824120004-auth-seed-demo-user.ts`) needs
  no special handling — it runs like any other migration via
  `yarn migration:run`.
