# Bootstrap the NestJS application skeleton

Replace the current `backend/package.json` (Express/Sequelize deps) with a NestJS + TypeORM
one, add strict TypeScript configuration for ES Modules, and stand up the minimal
`AppModule`/`main.ts` skeleton. Migrate the existing health-check route as the first working
NestJS controller, so there's an early smoke test that the new stack boots inside the dev
container before the rest of the migration builds on top of it.

- Add NestJS core deps (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`,
  `@nestjs/typeorm`, `typeorm`, `mysql2` (already present), `@nestjs/event-emitter`,
  `@nestjs/jwt`, `@nestjs/config`) and remove `express`, `express-session`, `sequelize`,
  `sequelize-cli` from `backend/package.json`.
- Add `backend/tsconfig.json` (strict mode, ES Modules — `"module": "NodeNext"`,
  `"moduleResolution": "NodeNext"`) and `backend/nest-cli.json`.
- Create `backend/src/main.ts` (Nest app bootstrap, reads `PORT`/`KERGHAN_SECRET_KEY` via
  `@nestjs/config`, httpOnly cookie support via `cookie-parser`) and `backend/src/app.module.ts`
  (root module importing `ConfigModule`, `TypeOrmModule.forRootAsync(...)`, and — once created in
  later steps — `AuthModule`).
- Create `backend/src/health/health.controller.ts` with the existing health-check route
  (`GET /health.json`), replacing `backend/lib/server/handlers`' current implementation of it.
- Delete `backend/bin/server.js` and the old `backend/lib/server/` framework files
  (`WebServer.js`, `Router.js`, `RouteRegister.js`, `RequestHandler.js`, `HandlerConfig.js`,
  `handlers/`) once their responsibilities are covered by NestJS itself — keep them until Step 05
  reimplements the routes they currently serve, then remove in this step's cleanup pass or a
  follow-up commit once nothing references them.
- Record the compiled entrypoint path (`nest-cli.json`'s `outDir`, typically `dist/main.js`) —
  needed by `infra`'s [Update backend Dockerfiles for the TypeScript build](../infra/01-update-dockerfiles-for-ts-build.md).

## Files to Change

- `backend/package.json` — swap Express/Sequelize deps for NestJS/TypeORM, update `main` entry
- `backend/tsconfig.json` — new, strict TS + ES Modules config
- `backend/nest-cli.json` — new, NestJS CLI config
- `backend/src/main.ts` — new, app bootstrap
- `backend/src/app.module.ts` — new, root module
- `backend/src/health/health.controller.ts` — new, migrated health-check route
- `backend/bin/server.js` — removed (superseded by `src/main.ts`)
