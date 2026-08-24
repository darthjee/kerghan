# Architect Plan: Migrate backend to NestJS with modular architecture

Main plan: [plan.md](plan.md)

## Shared contracts

- Own the entrypoint path change (`bin/server.js` → compiled `dist/main.js` or equivalent) and
  hand the exact path to `infra` once `nest-cli.json`/`tsconfig.json`'s `outDir` is set.
- Keep `backend/package.json`'s `coverage` and `lint` script names unchanged so `infra` never has
  to touch CI job commands, only add a build step ahead of them.
- Replace Sequelize CLI config (`.sequelizerc`, `config/database.js`) with a TypeORM data source
  and document the exact migration CLI command for `infra` to wire into the Makefile.

## Steps

- [01 — Bootstrap the NestJS application skeleton](architect/01-bootstrap-nestjs-skeleton.md)
- [02 — Core layer: DB connection and JWT Guard](architect/02-core-db-and-jwt-guard.md)
- [03 — LazyModuleLoader and module classification wiring](architect/03-lazy-module-loader.md)
- [04 — Auth module: entities](architect/04-auth-module-entities.md)
- [05 — Auth module: service, controller, DTOs](architect/05-auth-module-service-controller.md)
- [06 — Auth module: JWT/refresh-token flow and `user.registered` event](architect/06-auth-module-jwt-flow.md)
- [07 — Migrate backend tests from Jasmine to Jest](architect/07-migrate-tests-to-jest.md)
- [08 — Introduce the `backend` specialist agent](architect/08-introduce-backend-agent.md)
- [09 — Documentation updates](architect/09-documentation-updates.md)

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` and
  `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`) —
  commands stay the same; only their behavior changes once `infra`'s build step and this plan's
  Jest/TypeScript migration land together.

## Notes

- `backend/` currently has no owning specialist agent — per `.claude/agents/architect.md`,
  the architect owns `backend/` changes until one exists. Step 08 in this plan is what creates
  that agent; all application-code steps here (01–07, 09) are still done directly by the
  architect since the agent doesn't exist until this plan lands.
- Existing `Authenticator`/`Registrar`/`UserSerializer` classes and their specs
  (`backend/lib/accounts/`, `backend/spec/accounts/`) are the source material for the Auth
  module's service layer — port their logic rather than rewriting from scratch, adapting to
  NestJS DI and TypeORM entities.
- The existing `users` migration (`backend/migrations/20260808060719-create-users.js`) and
  demo-user seeder define the current `User` shape — carry over the same columns into the new
  `entities/user.entity.ts` unless the issue's fields (refresh token, session) require additions.
