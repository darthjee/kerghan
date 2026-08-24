# Plan: Migrate backend to NestJS with modular architecture

Issue: [24-use-next-js-and-modularization.md](../issues/24-use-next-js-and-modularization.md)

## Overview

Replace the current Express + Sequelize backend skeleton with a NestJS + TypeORM + MySQL
application, following the module classification and patterns established in
[darthjee/ward](https://github.com/darthjee/ward/blob/main/docs/agents/architeture-specs/architecture.md)
(core / always-on / lazy modules, `LazyModuleLoader`, hybrid DI + event-driven inter-module
communication). Deliver the first module (Auth, always-on) with JWT + refresh-token rotation,
switch backend tests from Jasmine to Jest, and introduce a `backend` specialist agent now that
the stack is settled. The application code, module architecture, and specialist-agent/docs work
is owned directly by the `architect` (per `.claude/agents/architect.md`'s stated interim policy —
`backend/` has no owning specialist yet, and creating one is itself part of this issue); the
Docker/CI/Makefile plumbing that has to build and run the new TypeScript app is owned by `infra`.

## Agents involved

- [architect](architect.md)
- [infra](infra.md)

## Shared contracts

- **Entrypoint**: the compiled app's entrypoint moves from `bin/server.js` (plain ESM, run
  directly by Node) to a TypeScript build output, e.g. `dist/main.js` (exact path confirmed by
  `architect` once `nest build`'s `outDir` is set in `tsconfig.json`/`nest-cli.json`). `infra`
  must update every Dockerfile's `CMD`/entry command from `["node", "bin/server.js"]` to the new
  compiled path, and add a `nest build` (or `tsc`) step to the image build stages that currently
  only run `yarn install` (`dockerfiles/kerghan-base`, `dockerfiles/production_kerghan`,
  `dockerfiles/production_kerghan-base`).
- **npm script names stay stable**: `architect` keeps `backend/package.json`'s `coverage` and
  `lint` script names unchanged (only their implementation swaps: Jasmine+c8 → Jest,
  ESLint config updated for TS) so `.circleci/config.yml`'s `backend_tests`/`backend_checks`
  jobs (`npm run coverage`, `npm run lint`) and `docs/agents/contributing.md`'s CI table need no
  command-name changes — only `infra` needs to add the TS build step ahead of those commands.
- **Migrations command**: `architect` replaces `backend/.sequelizerc`/`backend/config/database.js`
  (Sequelize CLI config) with TypeORM's data-source config and documents the exact TypeORM CLI
  migration command (e.g. `typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`)
  for `infra` to wire into the Makefile's `setup` target, replacing
  `yarn sequelize-cli db:migrate`.
- **Dev workflow unchanged**: `make dev-up`, `make dev`, `make tests` must keep working the same
  way from the developer's point of view (per the issue's "Backward compatibility" section) —
  `infra` adjusts `docker-compose.yml`/`Makefile` internals only as needed to run the new stack,
  not the target names or developer-facing workflow.
