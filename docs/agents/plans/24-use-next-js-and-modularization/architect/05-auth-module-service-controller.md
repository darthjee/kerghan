# Auth module: service, controller, DTOs

Build the Auth module itself following the standard module structure from the issue, porting the
existing `Authenticator`/`Registrar`/`UserSerializer` logic (`backend/lib/accounts/`) into
NestJS's DI-based service/controller split rather than rewriting the business logic from
scratch.

- `backend/src/auth/dto/login.dto.ts`, `dto/register.dto.ts`, `dto/refresh-token.dto.ts` — Nest
  `class-validator`-annotated request DTOs.
- `backend/src/auth/auth.service.ts` — business logic ported from `Authenticator.js`/
  `Registrar.js`: password hashing (`bcryptjs`, already a dependency), credential verification,
  user registration, refresh-token rotation, session bookkeeping. Depends only on the entities'
  repositories (constructor-injected, per `docs/agents/contributing.md`'s DI rule) — no direct
  env var reads.
- `backend/src/auth/auth.controller.ts` — `POST /auth/login`, `POST /auth/register`,
  `POST /auth/refresh`, `POST /auth/logout`, delegating to `auth.service.ts`. Registers the
  `@Public()` escape hatch from [Step 02](02-core-db-and-jwt-guard.md)'s guard on `/login` and
  `/register`.
- `backend/src/auth/auth.module.ts` — module definition importing `TypeOrmModule.forFeature([...])`
  for the three Auth entities, declaring the controller/service/providers, and exporting
  `AuthService` for other modules' direct-DI reads (per the issue's inter-module communication
  pattern). Import `AuthModule` into `AppModule` as always-on (not lazy).
- Remove `backend/lib/accounts/Authenticator.js`, `backend/lib/accounts/Registrar.js`,
  `backend/lib/serializers/UserSerializer.js`, and their specs once ported — their existing specs
  are the basis for [Step 07](07-migrate-tests-to-jest.md)'s Jest equivalents, not to be deleted
  before that step captures their coverage.

## Files to Change

- `backend/src/auth/dto/login.dto.ts`, `dto/register.dto.ts`, `dto/refresh-token.dto.ts` — new
- `backend/src/auth/auth.service.ts` — new, ported from `lib/accounts/Authenticator.js` +
  `Registrar.js`
- `backend/src/auth/auth.controller.ts` — new
- `backend/src/auth/auth.module.ts` — new
- `backend/src/app.module.ts` — import `AuthModule`
- `backend/lib/accounts/`, `backend/lib/serializers/` — removed once ported (after Step 07)
