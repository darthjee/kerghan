# Architecture — Backend: Request pipeline

Part of [Architecture — Backend](../backend.md): routing, the data source, the global guards and
the health probes.

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
one deliberate exception to the [DI-only rule](error-responses.md#dependency-injection-only), since it's also consumed standalone by the
TypeORM CLI (`yarn migration:run`/`migration:revert`), outside Nest's DI container entirely.
`AppModule` builds its own, DI-friendly `TypeOrmModule.forRootAsync` options through
`ConfigService` instead of importing this file, so the two stay independently testable/usable.

## Origin Guard (CSRF)

`core/origin.guard.ts` is the **first** global `APP_GUARD` in `AppModule`, registered ahead of
`JwtGuard`, so a forged cross-site request to an authenticated route gets `403` rather than
`401`. It checks only `POST`/`PUT`/`PATCH`/`DELETE`, deciding from the `Sec-Fetch-Site` and
`Origin` headers, and trusts exactly the origins resolved by `buildCorsOptions`
(`core/cors-config.ts`). Requests with neither header (non-browser clients, supertest e2e
specs) pass. See [`security.md`](../security.md#csrf) for the decision table and rationale.

## Health probes

`health/health.controller.ts` exposes two public, `never`-cached probes:

| Route | Purpose | HTTP | Body |
|---|---|---|---|
| `GET /health.json` | identity and liveness — the process is up; touches no dependency | `200` | `{ "app": "kerghan", "status": "ok", "version": "<semver>" }` |
| `GET /ready.json` | readiness — every component is up | `200` | `{ "app": "kerghan", "status": "ok", "version": "<semver>", "checks": { "database": "up", "workers": "up" } }` |
| `GET /ready.json` | readiness — a non-fatal component is down, the backend still serves | `200` | `{ "app": "kerghan", "status": "degraded", "version": "<semver>", "checks": { "database": "up", "workers": "down" } }` |
| `GET /ready.json` | readiness — the database is down (`workers` is still reported as measured) | `503` | `{ "app": "kerghan", "status": "error", "version": "<semver>", "checks": { "database": "down", "workers": "up" } }` |

Both bodies are built by `health/health.service.ts` (`HealthService#liveness` and
`HealthService#checkReadiness`):

- `app` is always `"kerghan"`. It is the identity marker: a client checks `app`, not the status
  code or the `Server` header.
- `version` is the release semver, read once at boot from `backend/package.json`. When that file
  cannot be read, or holds no non-empty `version`, the key is omitted, one warning is logged and
  the probe answers normally.
- `status` is derived from `checks`: `error` when `database` is not `up`, else `degraded` when
  `workers` is not `up`, else `ok`. Only `error` answers `503`. `/health.json` is `200` whenever
  the backend answers at all.
- `checks.database` is `SELECT 1` through the injected TypeORM `DataSource`.
- `checks.workers` is [`WorkersService#isRunning()`](../../modules/workers.md#workersservice-contract):
  `up` only while the worker engine is running. A crashed or exited engine, and a shutdown
  (including its drain), read `down`. Queue depth and job failures are not health.
- SMTP and the GitHub API are deliberately not checked.
- Keys are additive only: `app`, `status` and `version` keep their names and meanings, and a new
  component is a new `checks` key.
- `status: "down"` and the check state `"unknown"` are reserved for the Tent fallback for an
  unreachable backend (#613). The backend never emits them.

No body carries error messages, hosts, stack traces or credentials; a failed check is logged
through `LoggerService` instead (the `workers` warning once per transition to `down`). The `503`
is set on the response (`@Res({ passthrough: true })`) rather than thrown, so
`HttpExceptionFilter` does not reshape it into the standard error body.

## JWT Guard

`core/jwt.guard.ts` is registered as a global `APP_GUARD` in `AppModule`, so every route requires
a valid access token by default. Routes that must stay reachable without one (`/health.json`,
`/ready.json`, and the Auth module's own `login.json`/`register.json`/`refresh.json`/`logoff.json`) opt out with
`@Public()`. Beyond the signature check, it is also the per-request session gate: the token's
`sid` must name an active session of its `sub`, whose user is `approved`, looked up through
Core's `SESSION_LOOKUP` token (implemented by the Auth module), and `request.user` is built
from that user row — see `docs/agents/modules/auth/sessions.md`'s "JWT/refresh-token flow".
`JwtModule` itself is registered with `{ global: true }` in `AppModule` — without
that, only modules that import `JwtModule` directly (not just `AuthModule`) can inject
`JwtService`, which broke `AuthService`'s constructor resolution the first time this was wired up.

## Admin Guard

`core/admin.guard.ts` is another global `APP_GUARD`, registered in `AppModule` right after
`JwtGuard` (`APP_GUARD`s run in registration order, and `AdminGuard` depends on `request.user`
already being populated by `JwtGuard`). It is a no-op unless the route (or controller) is
annotated `@AdminOnly()` (`core/admin-only.decorator.ts`), in which case it requires
`request.user.isAdmin === true`, throwing `403 Forbidden` otherwise — it never re-verifies the
JWT itself. See `docs/agents/modules/auth/admin-and-events.md`'s "Admin authorization" section for the
`isAdmin` provisioning details (`request.user.isAdmin` comes from the database, not the JWT
claim).
