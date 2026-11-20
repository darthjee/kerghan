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
├── main.ts                    # boots the app: cookie-parser (session cookies), global ValidationPipe, PORT
├── app.module.ts              # root module: ConfigModule, TypeOrmModule, JwtModule (global),
│                               #   EventEmitterModule, AuthModule, core providers, global
│                               #   OriginGuard + JwtGuard + AdminGuard, HttpExceptionFilter
├── core/                      # Core layer — always resident, independent of any feature module
│   ├── origin.guard.ts        #   global CanActivate rejecting cross-site mutating requests (CSRF)
│   ├── jwt.guard.ts           #   global CanActivate verifying the access-token cookie
│   ├── public.decorator.ts    #   @Public() escape hatch from the JWT guard
│   ├── admin.guard.ts         #   global CanActivate enforcing @AdminOnly() routes
│   ├── admin-only.decorator.ts #  @AdminOnly() marker read by AdminGuard
│   ├── access-token-payload.ts #  shape signed by AuthService / verified by JwtGuard
│   ├── http-exception.filter.ts #  global APP_FILTER writing the standard error body
│   ├── error-codes.ts         #   category/specific error codes + status → code mapping
│   ├── locked.exception.ts    #   423 Locked HttpException
│   ├── cache-token.service.ts #   HMAC cache-token generation for Tent cache keying
│   ├── lazy-module-loader.service.ts  # thin wrapper around Nest's LazyModuleLoader
│   └── tests/
├── database/
│   ├── data-source.ts         # TypeORM DataSource config, read once from env vars (CLI + AppModule)
│   └── migrations/            # <timestamp>-<module>-<action>.ts
├── health/
│   ├── health.controller.ts   # GET /health.json (liveness) + GET /ready.json (readiness) — @Public()
│   ├── health.service.ts      # readiness checks (database only)
│   └── tests/
├── auth/                      # first feature module — see docs/agents/modules/auth.md
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth-cookies.ts        #   session cookies (access_token, refresh_token on /auth, logged_in): set/clear/read
│   ├── auth-response.ts       #   respondWithSession: sets the session cookies, returns { user }
│   ├── dto/
│   ├── entities/
│   ├── events/
│   └── tests/
└── mail/                      # Mail module — always-on, general-purpose transactional email sender, no HTTP surface
    ├── mail.module.ts
    ├── mail.config.ts
    ├── mail.service.ts
    ├── mail.method.ts
    ├── mail.tokens.ts
    ├── render-template.ts
    ├── template-registry.ts
    ├── templates/            # Filesystem email templates — subject.txt / body.txt / body.html per <name>/
    └── tests/
└── workers/                   # Workers module — always-on in-process background worker pool (deku-swarm), no HTTP surface
    ├── workers.module.ts
    ├── workers.service.ts
    ├── workers-config.ts
    ├── workers-logger.ts
    └── tests/
```

## Owned tables

Each module owns its tables under a distinct prefix (see [Modular Pattern](./modular-pattern.md)
for the rule) — only Auth owns tables today (Mail has no HTTP surface and no entities, see
`docs/agents/modules/mail.md`). Column-level detail lives in `docs/agents/modules/auth/sessions.md`'s
"Entities" section, not repeated here.

| Table | Module | Notes |
|---|---|---|
| `auth_users` | Auth | |
| `auth_refresh_tokens` | Auth | |
| `auth_authorization_requests` | Auth | `user_id` is a logical FK (no physical FK, no cross-module JOIN) — `NULL` when the request's username didn't resolve to a real user |
| `auth_account_edit_lockouts` | Auth | `user_id` is a logical FK (no physical FK, no cross-module JOIN), unique — one row per user, upserted in place |

## Build

`nest build` (via `nest-cli.json`) compiles against `tsconfig.build.json`, not `tsconfig.json`
directly — `tsconfig.build.json` extends the base config but excludes `**/*.spec.ts`,
`**/*.e2e-spec.ts`, and `src/**/tests/**`, so test files never end up compiled into `dist/`.
`tsconfig.json` intentionally does **not** set `incremental: true`: combined with `nest-cli.json`'s
`deleteOutDir: true`, an incremental build's `.tsbuildinfo` cache can believe stale output is
still current after `dist/` is wiped externally (e.g. a container restart) and skip re-emitting
entirely, breaking `nest start --watch`.

`nest-cli.json`'s `compilerOptions.assets` copies the non-TS files under `mail/templates/**`
into `dist/`, and the mail template registry resolves that directory via `import.meta.url` so it
works from `dist/mail/` as well as `src/mail/`.

## Pages

- [backend/request-pipeline.md](backend/request-pipeline.md) — read when adding or changing a
  route (the `.json` convention), the TypeORM CLI data source, the Origin Guard (CSRF), the health
  probes, or the JWT and Admin guards.
- [backend/error-responses.md](backend/error-responses.md) — read when throwing or changing an
  error: the standard body, category and specific codes, `retryAfterSeconds`, enumeration safety,
  and the dependency-injection-only rule.
- [backend/testing.md](backend/testing.md) — read when writing backend specs: unit and e2e
  fakes, the DB-backed MySQL tier, and the injected `Clock`.
