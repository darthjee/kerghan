# Update backend Dockerfiles for the TypeScript build

The current backend Dockerfiles only run `yarn install`/`yarn_builder.sh` (caching
`node_modules`) — none of them compile anything, since Express runs the ESM source directly.
NestJS needs a `nest build` (or `tsc`) step before the app can run, and the `CMD`/entrypoint
changes from the plain JS file to the compiled output.

- `dockerfiles/kerghan-base/Dockerfile` and `dockerfiles/kerghan/Dockerfile` (dev images): add a
  build stage running `yarn build` (mapped to `nest build` in `backend/package.json`'s scripts)
  after `yarn_builder.sh`, and change `CMD ["node", "bin/server.js"]` to
  `CMD ["node", "dist/main.js"]` (confirm exact path against `architect`'s
  [Step 01](../architect/01-bootstrap-nestjs-skeleton.md)).
- `dockerfiles/production_kerghan-base/Dockerfile` and `dockerfiles/production_kerghan/Dockerfile`
  (prod images): same `yarn build` step addition and `CMD` change; keep the existing
  `RUN yarn install --production` / `rm -rf spec` pruning steps, adjusting `spec` to whatever the
  new test directory is called (`src/**/tests/` per `architect`'s plan — prune those instead, not
  `spec/`, once the migration lands) so prod images don't ship test files.
- `dockerfiles/circleci_kerghan-base/Dockerfile`: no `CMD` here (test-only base), but the base
  image consumers (`backend_tests`/`backend_checks`) will need the build step too — verify
  whether it belongs in this base image or in the CI job step itself
  ([Step 04](04-update-circleci-backend-jobs.md) covers that).

## Files to Change

- `dockerfiles/kerghan-base/Dockerfile` — add build step, update `CMD`
- `dockerfiles/kerghan/Dockerfile` — verify no `CMD` override conflicts with the base image's
- `dockerfiles/production_kerghan-base/Dockerfile` — update `CMD`
- `dockerfiles/production_kerghan/Dockerfile` — add build step, adjust prod pruning step
