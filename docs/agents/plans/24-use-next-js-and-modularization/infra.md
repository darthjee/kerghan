# Infra Plan: Migrate backend to NestJS with modular architecture

Main plan: [plan.md](plan.md)

## Shared contracts

- Wait on `architect` for: the compiled entrypoint path (`dist/main.js` or equivalent), and the
  exact TypeORM CLI migration command — both needed before this plan's steps can be finalized;
  placeholders below assume `dist/main.js` and `typeorm-ts-node-commonjs migration:run -d
  dist/database/data-source.js`, confirm against `architect`'s actual output before merging.
- `backend/package.json`'s `coverage` and `lint` script names are guaranteed to stay stable —
  `.circleci/config.yml`'s `backend_tests`/`backend_checks` steps only need a new build step
  added ahead of `npm run coverage`/`npm run lint`, not a command rename.
- `make dev-up`, `make dev`, `make tests` must keep the same developer-facing behavior/workflow.

## Steps

- [01 — Update backend Dockerfiles for the TypeScript build](infra/01-update-dockerfiles-for-ts-build.md)
- [02 — Update docker-compose.yml for the new entrypoint](infra/02-update-docker-compose.md)
- [03 — Update the Makefile setup target for TypeORM migrations](infra/03-update-makefile-setup-target.md)
- [04 — Update CircleCI backend jobs for the TS build + Jest](infra/04-update-circleci-backend-jobs.md)

## CI Checks

- `.circleci/`, `dockerfiles/`, `docker-compose.yml` — no local equivalent, per
  `docs/agents/contributing.md`'s CI table; verify by reading `.circleci/config.yml`'s updated
  job definitions and by running `make dev-up`/`make tests` locally to confirm the dev workflow
  still works end to end.

## Notes

- Confirm with `architect` whether `backend/config/database.js`'s env var names
  (`KERGHAN_MYSQL_USER`, `_PASSWORD`, `_NAME`, `_HOST`, `_PORT`) carry over unchanged into the
  TypeORM data source — if so, no `.env`/`.env.dev.sample` changes are needed here.
