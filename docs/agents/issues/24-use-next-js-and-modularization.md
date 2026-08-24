# Issue: Migrate backend to NestJS with modular architecture

## Description

Kerghan's backend is currently an Express + Sequelize skeleton with three routes (`/health.json`, `/accounts/login.json`, `/accounts/register.json`) and no real models. Before the tracked-repo/label-rule data model is decided (see `docs/agents/product.md`), we need to migrate the backend to a modular architecture based on the pattern established in [darthjee/ward](https://github.com/darthjee/ward/blob/main/docs/agents/architeture-specs/architecture.md): NestJS + TypeORM + MySQL, with lazy-loaded modules.

This issue covers the migration, the creation of the first module (Auth), and introducing a `backend` specialist agent now that the stack is settled.

## Solution

### 1. Migrate backend from Express to NestJS

- Replace Express with NestJS as the application framework
- Replace Sequelize with TypeORM as the ORM
- Configure `tsconfig.json` for ES Modules + strict TypeScript
- Set up the base NestJS project structure under `backend/src/`
- Update `docker-compose.yml`, `dockerfiles/`, and `Makefile` targets for the new stack
- Migrate the existing health-check route to a NestJS controller

### 2. Establish modular architecture

Adopt the module classification and patterns from ward:

| Type | Loading | Examples |
|---|---|---|
| Core | Always resident, at boot | Router, JWT Guard, DB Connection, CacheToken Service |
| Always-on | Always resident, at boot | Auth Module |
| Lazy | On demand, first request | (future: tracked-repo, label-rule, etc.) |

Implement:

- `LazyModuleLoader` for on-demand module instantiation
- **Standard module structure** per module:
  - `<name>.module.ts` — Module definition (imports, providers, exports)
  - `<name>.controller.ts` — Module routes
  - `<name>.service.ts` — Business logic
  - `dto/` — Data Transfer Objects (request/response)
  - `entities/` — TypeORM entities
  - `events/` — Event handlers (@OnEvent) and event payloads
  - `tests/` — Unit and e2e tests for the module
- **Inter-module communication** (hybrid pattern):
  - **Direct DI (synchronous):** module exports its service; consumer imports the module. A module never writes to another module's tables; reads via exported service only. Cross-module references use logical foreign keys (store ID, no physical FK, no cross-module JOINs).
  - **Event-Driven (reactive):** via `@nestjs/event-emitter`. Fire-and-forget; event names follow `<entity>.<action>` (e.g. `user.registered`).
- **Database strategy:** single MySQL database, shared across modules. Each module owns its tables with a distinct prefix (`auth_`, etc.). Migrations live in `src/database/migrations/` with naming `<timestamp>-<module>-<action>.ts`.

### 3. First module: Auth (always-on)

Migrate existing `Authenticator` and `Registrar` into the Auth module:

- **Auth module structure:**
  - `auth.module.ts`
  - `auth.controller.ts` — POST /auth/login, POST /auth/register, POST /auth/refresh, POST /auth/logout
  - `auth.service.ts`
  - `dto/login.dto.ts`, `dto/register.dto.ts`, `dto/refresh-token.dto.ts`
  - `entities/user.entity.ts`, `entities/refresh-token.entity.ts`, `entities/session.entity.ts`
  - `events/user-registered.event.ts`
  - `tests/`
- **Authentication:** stateless JWT with refresh token rotation
  - Access token (JWT, 15 min) → httpOnly cookie
  - Refresh token (7 days) → response body, rotated on each use
  - Cache token (HMAC) → for Tent cache keying
- **Core JWT Guard** in `src/core/jwt.guard.ts` — verifies access token on every request, independent of any module

### 4. Introduce the `backend` specialist agent

`AGENTS.md`/`.claude/agents/architect.md` currently note there's no `backend` agent because the stack wasn't settled — it now is:

- Add `.claude/agents/backend.md`, scoped to `backend/`, following the conventions used by the other specialist agents (`frontend`, `infra`, `proxy`, `cache`)
- Update `.claude/agents/architect.md`'s specialist-agent table: remove the "🚧 not yet written" marker and the "no backend agent yet, architect owns backend/" note
- Update `AGENTS.md`'s "Specialist agents" section to list `backend` in the roster

## Documentation updates required

- [ ] `AGENTS.md` — update Backend stack section (Express → NestJS, Sequelize → TypeORM, Jasmine → Jest) and the specialist agents roster (add `backend`)
- [ ] `docs/agents/architecture/backend.md` — replace "precedent only" page with actual NestJS architecture
- [ ] `docs/agents/architecture/` — new page documenting the modular pattern (module classification, lazy loading, inter-module communication, DB strategy)
- [ ] `docs/agents/modules/auth.md` — Auth module documentation
- [ ] `docs/agents/contributing.md` — update backend code organization section (file naming, method order, ESLint rules for NestJS/TypeScript)
- [ ] `.claude/agents/backend.md` — new specialist agent definition
- [ ] `.claude/agents/architect.md` — remove the "no backend agent yet" note, add `backend` to the specialist agent table

## Backward compatibility

- Current Express backend has only 3 routes and no models — the frontend is a placeholder shell, so API contract changes are acceptable at this stage.
- The `docker-compose.yml` base service definition and `Makefile` targets (`dev`, `tests`, `setup`) must be updated but should preserve the same developer workflow (`make dev-up`, `make dev`, `make tests`).
- CircleCI config (`.circleci/config.yml`) must be updated for the new backend test/lint commands.

## Testing strategy

- **Unit tests:** each module's service, controller, and DTO validation
- **E2E tests:** module routes via NestJS `TestingModule`
- **Lazy loading verification:** confirm modules are not instantiated until first request hits their routes
- **Auth-specific:** login flow, refresh token rotation, token expiry, httpOnly cookie configuration, guard rejection of invalid tokens
- **Framework:** migrate from Jasmine to Jest (NestJS's native test runner) — settled; Jest's API is close enough to Jasmine's (`describe`/`it`/`expect`) that the migration cost is low, and it comes with tighter `TestingModule`/mocking/coverage integration than configuring Jasmine for NestJS would.

## Performance & security considerations

- **Memory:** NestJS lazy loading reduces startup footprint; MySQL connection pool should use a low limit (e.g. `poolSize: 5`) per ward's pattern
- **Security:** httpOnly + secure cookies for access token; refresh token rotation prevents replay attacks; JWT secret injected via env var (DI only, never read directly by classes)
- **Dependency injection:** all classes receive dependencies via constructor — no direct env var reads or global state imports (per `contributing.md`)

## CI considerations

| Modified folder | CI job(s) | Local commands |
|---|---|---|
| `backend/` | `backend_tests`, `backend_checks` | `docker-compose run kerghan_tests yarn test` and `docker-compose run kerghan_tests yarn lint` |

CircleCI config and the `contributing.md` CI table must be updated to reflect the new test/lint commands for NestJS/Jest.

## Out of scope

- Tracked-repo/label-rule data model (see `docs/agents/product.md`)
- Additional lazy modules beyond Auth
- Frontend changes (React placeholder shell stays as-is)
- GitHub OAuth integration (per AGENTS.md, planned as future addition)
