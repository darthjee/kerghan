# Core layer: DB connection and JWT Guard

Set up the TypeORM data source (replacing Sequelize's connection config) and the core JWT Guard
that verifies the access token on every request, independent of any module — per the issue's
"Core" module classification (always resident, at boot).

- Create `backend/src/database/data-source.ts` — TypeORM `DataSource` config reading
  `KERGHAN_MYSQL_*` env vars via DI (`ConfigService`), mirroring the shape of the current
  `backend/config/database.js` (same env var names, so no `.env`/`.env.dev.sample` changes are
  needed). Wire it into `AppModule` via `TypeOrmModule.forRootAsync`, with a low connection pool
  limit (`poolSize: 5`) per the issue's performance considerations and ward's precedent.
- Remove `backend/.sequelizerc` and `backend/config/database.js` (superseded by the TypeORM data
  source) — record the TypeORM CLI migration command this produces
  (e.g. `typeorm-ts-node-commonjs migration:run -d dist/database/data-source.js`) for `infra`'s
  [Update the Makefile setup target for TypeORM migrations](../infra/03-update-makefile-setup-target.md).
- Create `backend/src/core/jwt.guard.ts` — a Nest `CanActivate` guard verifying the access token
  (read from the httpOnly cookie), independent of any module, registered as a global guard in
  `AppModule` (with an `@Public()` decorator/metadata escape hatch for routes like
  `/auth/login`/`/auth/register` that must stay unauthenticated).
- Create `backend/src/core/cache-token.service.ts` — HMAC cache-token generation for Tent cache
  keying (per the issue's Auth module description), injected wherever a response needs to expose
  the cache token.

## Files to Change

- `backend/src/database/data-source.ts` — new, TypeORM data source config
- `backend/src/app.module.ts` — wire in `TypeOrmModule.forRootAsync`
- `backend/src/core/jwt.guard.ts` — new, global JWT guard
- `backend/src/core/cache-token.service.ts` — new, HMAC cache-token service
- `backend/.sequelizerc` — removed
- `backend/config/database.js` — removed
