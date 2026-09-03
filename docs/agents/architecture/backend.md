# Architecture — Backend

NestJS + TypeORM + MySQL, following the module classification and patterns established in
[darthjee/ward](https://github.com/darthjee/ward/blob/main/docs/agents/architeture-specs/architecture.md).
See [Modular Pattern](./modular-pattern.md) for the cross-cutting rules (module classification,
lazy loading, inter-module communication, database strategy) any module — this one or a future
one — must follow. See `docs/agents/modules/auth.md` for the Auth module itself.

## Stack

- NestJS (Express platform adapter) + TypeScript, strict mode, ES Modules
  (`"module": "NodeNext"`, `.js` extensions required on every relative import path, per
  Node's ESM resolution rules)
- TypeORM (entity/repository ORM + CLI migrations) + MySQL 8, connection pool capped at
  `poolSize: 5` (per ward's precedent and the issue's performance considerations)
- Jest + `@swc/jest` (transform) + `supertest` (e2e HTTP assertions) + `@nestjs/testing`
- ESLint (flat config, `typescript-eslint` + the same `complexity`/`jsdoc`/`import`/
  `sort-class-members` plugins used project-wide)
- Yarn (package manager)

## Layout

```
backend/src/
├── main.ts                    # boots the app: cookie-parser, global ValidationPipe, PORT
├── app.module.ts              # root module: ConfigModule, TypeOrmModule, JwtModule (global),
│                               #   EventEmitterModule, AuthModule, core providers, global JwtGuard
├── core/                      # Core layer — always resident, independent of any feature module
│   ├── jwt.guard.ts           #   global CanActivate verifying the access-token cookie
│   ├── public.decorator.ts    #   @Public() escape hatch from the JWT guard
│   ├── cache-token.service.ts #   HMAC cache-token generation for Tent cache keying
│   ├── lazy-module-loader.service.ts  # thin wrapper around Nest's LazyModuleLoader
│   └── tests/
├── database/
│   ├── data-source.ts         # TypeORM DataSource config, read once from env vars (CLI + AppModule)
│   └── migrations/            # <timestamp>-<module>-<action>.ts
├── health/
│   └── health.controller.ts   # GET /health.json — @Public()
├── auth/                      # first feature module — see docs/agents/modules/auth.md
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   ├── entities/
│   ├── events/
│   └── tests/
└── mail/                      # Mail module — always-on, general-purpose transactional email sender, no HTTP surface
    ├── mail.module.ts
    ├── mail.config.ts
    ├── mail.service.ts
    ├── mail.tokens.ts
    └── tests/
```

## Build

`nest build` (via `nest-cli.json`) compiles against `tsconfig.build.json`, not `tsconfig.json`
directly — `tsconfig.build.json` extends the base config but excludes `**/*.spec.ts`,
`**/*.e2e-spec.ts`, and `src/**/tests/**`, so test files never end up compiled into `dist/`.
`tsconfig.json` intentionally does **not** set `incremental: true`: combined with `nest-cli.json`'s
`deleteOutDir: true`, an incremental build's `.tsbuildinfo` cache can believe stale output is
still current after `dist/` is wiped externally (e.g. a container restart) and skip re-emitting
entirely, breaking `nest start --watch`.

## Routing convention

Every route the backend exposes must end in `.json` — Tent's `backend.php` rule
(`proxy/dev_configuration/rules/backend.php`) only forwards requests whose URI `ends_with`
`.json` to the backend; anything else falls through to the frontend/static catch-all. This
applies to **every** route, including ones that don't look like a resource fetch at a glance
(e.g. `POST /auth/login.json`, not `POST /auth/login`) — verify a new route end-to-end through a
live `kerghan_proxy` container, not just by hitting `kerghan_app` directly, before considering it
done.

## Data source

`src/database/data-source.ts` reads `KERGHAN_MYSQL_*` env vars directly (`process.env`) — the
one deliberate exception to the DI-only rule below, since it's also consumed standalone by the
TypeORM CLI (`yarn migration:run`/`migration:revert`), outside Nest's DI container entirely.
`AppModule` builds its own, DI-friendly `TypeOrmModule.forRootAsync` options through
`ConfigService` instead of importing this file, so the two stay independently testable/usable.

## JWT Guard

`core/jwt.guard.ts` is registered as a global `APP_GUARD` in `AppModule`, so every route requires
a valid access token by default. Routes that must stay reachable without one (`/health.json`, and
the Auth module's own `login.json`/`register.json`/`refresh.json`/`logoff.json`) opt out with
`@Public()`. `JwtModule` itself is registered with `{ global: true }` in `AppModule` — without
that, only modules that import `JwtModule` directly (not just `AuthModule`) can inject
`JwtService`, which broke `AuthService`'s constructor resolution the first time this was wired up.

## Dependency injection only

Classes never read env vars or import global state directly (`src/database/data-source.ts`
above is the sole, deliberate exception) — the DB connection, JWT secret, etc. are constructed
once (via `ConfigService`) and injected. See `docs/agents/contributing.md`'s DI rule.

## Testing

No live database in CI yet (`backend_tests` has no `cimg/mysql` service container) — specs inject
mocked/fake TypeORM repositories rather than hitting MySQL:

- **Unit specs** (`*.spec.ts`): plain `jest.fn()`-based repository doubles, service instantiated
  directly (no `TestingModule` needed when there's no DI graph to exercise).
- **e2e specs** (`*.e2e-spec.ts`): a real `INestApplication` built via `Test.createTestingModule`,
  with each entity's repository token overridden
  (`.overrideProvider(getRepositoryToken(Entity)).useValue(fakeRepo)`) by a small in-memory fake
  (array-backed `findOne`/`findOneBy`/`create`/`save`/`update`), driven end-to-end via
  `supertest`. This exercises real controller/service/DTO-validation/guard behavior without a
  real database.
- **`LazyModuleLoader`-dependent specs**: need a real Nest application context
  (`NestFactory.createApplicationContext`), not a bare `Test.createTestingModule` — the loader's
  internals (module scanning) aren't fully wired by the lightweight testing container.

Add a `cimg/mysql` service to `.circleci/config.yml` (see `docs/agents/architecture/infra.md`)
when the first spec actually needs a real database (e.g. testing a TypeORM migration itself, or
a query too complex to fake convincingly).
