# Issue: Backend Authorization Request Entity Migration And Create Poll Endpoints

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issue 1 (`TokenService` extraction) — merged as #59 / PR #68, so
`TokenService.issueTokens` is already available (internal `AuthModule` collaborator, not
exported; the new service can inject it because it lives in the same module).

This is the requesting-device half of the login-by-authorization flow: the data model, the
service, and the two `@Public()` endpoints a not-yet-logged-in device uses — create a request for
a username, then poll it until it is approved (or denied / expired). The approver-side endpoints
are #58 sub-issue 3; the frontend that drives these is #58 sub-issue 6.

Model the scoped, hashed, time-limited poll token on the existing password-reset machinery:
`backend/src/auth/password-reset.service.ts`, `entities/password-reset-token.entity.ts`, migration
`backend/src/database/migrations/20260901120005-auth-create-password-reset-tokens.ts`.

## Problem

- There is no entity, table, or status machine for "a login another device vouches for".
- There is no per-request token that authorises polling one request without being a login
  credential.
- Two concurrent polls arriving just after approval must not both receive credentials.
- An authorization request created for an unknown or someone-else's username must not reveal that
  fact (Kerghan's enumeration-safety contract — see `docs/agents/product.md` and
  `PasswordResetService#recover`).

## Expected Behavior

- `POST /auth/authorization-requests.json` (`@Public()`, body `{ username }`) creates a row with
  `status = open`, stores the requesting IP and User-Agent, sets `expires_at` from
  `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` (default `3600000` = 1h), and returns
  `{ uuid, pollToken, expiresAt }`. The response shape and timing are identical whether or not
  `username` matches a real user; a non-matching row stores `user_id = NULL` and can never be
  approved. Only `sha256(pollToken)` is persisted.
- `POST /auth/authorization-requests/:uuid/poll.json` (`@Public()`, body `{ pollToken }`):
  - unknown `uuid` **or** wrong `pollToken` → `404` (indistinguishable).
  - `open` and not expired → `{ status: 'open' }`.
  - `open` and past `expires_at` → row flipped to `expired`, `{ status: 'expired' }`.
  - `approved` → the first poll atomically transitions the row `approved → logged`, mints a
    standard session (`TokenService.issueTokens`) and returns
    `{ status: 'approved', user, refreshToken }` + `Set-Cookie access_token`. Any later or losing
    poll gets `{ status: 'logged' }` with no credentials.
  - `denied` / `logged` → `{ status }` with no credentials.
- Both endpoints set `X-Skip-Cache: true`.

## Solution

### Scope

The `auth_authorization_requests` table + entity, `AuthorizationRequestService` (create + poll
paths, the atomic claim, lazy expiry), the two `@Public()` controller routes, their DTOs, and the
`created` / `logged` events. Unit + e2e tests.

Explicitly **out of scope**:

- Approver-side endpoints (`mine` / `authorize` / `deny`) and their events — #58 sub-issue 3.
- Rate-limiting, per-user concurrent-`open` caps, brute-force protection — #58 sub-issue 8.
- Physical purge of resolved rows — noted as a follow-up in #58.
- Any frontend — #58 sub-issue 6.

### What needs to be done

- **Entity** `backend/src/auth/entities/authorization-request.entity.ts` →
  `@Entity('auth_authorization_requests')`, modelled on `password-reset-token.entity.ts`
  (logical FK, hash-only token). Columns: `id`; `uuid` (`varchar(36)`, unique,
  `crypto.randomUUID()`); `username` (`varchar`); `user_id` (`int`, nullable); `status` (MySQL
  native `enum('open','approved','denied','logged','expired')`, default `open` — this is the
  first `type: 'enum'` column in the backend; entity side is
  `@Column({ type: 'enum', enum: [...], default: 'open' })`); `poll_token_hash`
  (`varchar`, unique); `request_ip` (`varchar(45)`); `request_user_agent` (`varchar(512)`);
  `approved_by_user_id` (`int`, nullable); `created_at` (`@CreateDateColumn`); `expires_at`
  (`datetime`); `resolved_at` (`datetime`, nullable); `logged_at` (`datetime`, nullable).
- **Migration**
  `backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts` (the
  current tail is `20260903120007-auth-promote-demo-user-admin.ts`), same
  `queryRunner.createTable` + separate `queryRunner.createIndex(...)` calls as
  `20260901120005-…`, index names following the `idx_<table>_<cols>` convention. The `status`
  column is `new TableColumn({ type: 'enum', enum: [...], default: "'open'" })` — note the
  quoted string literal for `default` (unlike `default: 'CURRENT_TIMESTAMP'`, which is an
  unquoted function). Indexes: unique `uuid`, unique `poll_token_hash`, `(user_id, status)`,
  `(expires_at)`. `down()` drops the table.
- **Service** `backend/src/auth/authorization-request.service.ts` — internal collaborator (not
  exported from `AuthModule`), like `PasswordResetService`. Injects
  `Repository<AuthorizationRequest>`, `Repository<User>`, `TokenService`, `EventEmitter2`,
  `ConfigService`.
  - `create(username, ip, userAgent)` — resolve `username → user` (may be `null`); mint
    `randomBytes(48).toString('hex')`; persist with `poll_token_hash = sha256(token)`,
    `expires_at = now + ttl`; emit `authorization-request.created`; return
    `{ uuid, pollToken, expiresAt }`. Never branch the return shape on whether the user exists.
    The TTL is read as `Number(configService.get('KERGHAN_AUTHORIZATION_REQUEST_TTL_MS'))`
    with a module-level `const DEFAULT_… = 3600000` fallback — coerce with `Number(...)` (as
    `mail/mail.config.ts` does) rather than the bare `get<number>(key, default)` form used in
    `password-reset.service.ts`, because `ConfigService.get` returns the raw **string** when the
    env var is actually set and `Date.now() + '<string>'` would silently corrupt `expires_at`.
  - `poll(uuid, pollToken)` — `findOneBy({ uuid, pollTokenHash: sha256(pollToken) })`; a miss on
    either → `NotFoundException`. Then the status handling in "Expected Behavior". The
    `approved → logged` transition is a single
    `repo.createQueryBuilder().update().set({ status: 'logged', loggedAt: () => 'CURRENT_TIMESTAMP' }).where("uuid = :uuid AND status = 'approved'").execute()`;
    `result.affected === 1` is the guard — the winner calls `tokenService.issueTokens(user)` and
    emits `authorization-request.logged`; every loser re-reads and returns `{ status: 'logged' }`.
  - Lazy expiry: an `open` row past `expires_at` seen by `poll` is updated to `expired`
    (`resolved_at = now`) before returning.
  - Within this issue's scope `resolved_at` is set **only** on the lazy-expiry path. The winning
    `approved → logged` transition sets `logged_at` but leaves `resolved_at` NULL — it is the
    approver side (`authorize` / `deny`, #58 sub-issue 3) that stamps `resolved_at` on
    approval/denial. So a `logged` row produced by `poll` legitimately has `logged_at` set and
    `resolved_at` NULL until sub-issue 3 lands. This is intended; do not add a `resolved_at`
    write to the claim `UPDATE`.
- **DTOs** `backend/src/auth/dto/create-authorization-request.dto.ts` (`{ username }`) and
  `poll-authorization-request.dto.ts` (`{ pollToken }`), `@IsString @IsNotEmpty`, mirroring
  `login.dto.ts`.
- **Controller** `backend/src/auth/authorization-request.controller.ts` — `@Controller('auth')`,
  thin, each route individually `@Public()` (from `backend/src/core/public.decorator.ts`, same
  per-method style as every `AuthController` route). Captures IP
  (`req.headers['x-forwarded-for']` first token, fallback `req.socket.remoteAddress`) and
  User-Agent (`req.headers['user-agent'] ?? ''`) and passes them as plain args — this parsing is
  entirely new (nothing in the backend reads these headers today). Put it in a plain
  (non-`@Injectable`) helper `backend/src/core/client-request.ts` — **bare name, no `.helper`
  suffix**, matching the existing `core/log-context.ts` / `core/access-token-payload.ts`
  precedent (no file in the backend uses a `.helper.ts` suffix).
- **Shared auth response** — the `{ user, refreshToken }` body + `Set-Cookie access_token` +
  `X-Skip-Cache` logic currently lives inline in `auth.controller.ts` as the private `#respond`
  (cookie block, needs `ConfigService` and the module-level `ACCESS_TOKEN_COOKIE` /
  `DEFAULT_ACCESS_TOKEN_TTL_MS` / `SKIP_CACHE_HEADER` consts) + `#serialize` (returns
  `{ id, username, email, isAdmin }`). Extract it into `backend/src/auth/auth-response.ts`
  (again bare name, no `.helper` suffix) carrying both the cookie block and the user
  serialization, and **refactor `AuthController` to consume the extracted helper too** so the
  device-authorization `logged` response and the password-login response cannot drift. The poll
  `{ status: 'approved', user, refreshToken }` body must serialize `user` through the same
  helper (identical `{ id, username, email, isAdmin }` shape). Every handler on the new
  controller sets `X-Skip-Cache: true`.
- **Events** `backend/src/auth/events/authorization-request-created.event.ts` and
  `-logged.event.ts` (dotted names `authorization-request.created` /
  `authorization-request.logged`, matching the `user.registered` / `password-recovery.requested`
  convention), mirroring `user-registered.event.ts` — plain class, `readonly` fields, JSDoc'd
  constructor. `EventEmitter2` is constructor-injected into the **service** (as in
  `PasswordResetService`), not the controller. No listeners and no `auth.module.ts` `providers`
  entry required — only define and emit the classes.
- **Module** `backend/src/auth/auth.module.ts` — add `AuthorizationRequest` to
  `TypeOrmModule.forFeature([...])`, register the controller and `AuthorizationRequestService`.
- **Docs** — add `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` to
  `docs/agents/environment-variables.md` (alongside `KERGHAN_ACCESS_TOKEN_TTL_MS`, as an
  optional consumed var defaulting to `3600000`).
- **Tests**: `backend/src/auth/tests/authorization-request.service.spec.ts` (create incl. the
  `NULL`-user path, poll for each status, the `affected`-rows claim guard with a row `approved`
  vs not, lazy expiry, uniform `404`, event emission) and
  `authorization-request.controller.e2e-spec.ts` (supertest + `cookieParser()` as in
  `auth.controller.e2e-spec.ts`): full `create → poll(open) → [manually flip to approved] →
  poll(approved: asserts `Set-Cookie` + `refreshToken`) → poll(logged: no body)`; expiry path;
  wrong poll token → `404`; two simultaneous post-approval polls → exactly one credential body;
  `X-Skip-Cache` on every response. Note: `createInMemoryRepo` is not a single shared helper — it
  is duplicated locally per e2e spec file (`auth.controller.e2e-spec.ts` implements
  `create/find/findOne/findOneBy/save/update`; `admin.controller.e2e-spec.ts` has a divergent
  variant with `find`/`ilike` support but no `update`). Neither has a `createQueryBuilder` stub,
  so the new `authorization-request.controller.e2e-spec.ts` needs its own local copy that
  additionally grows a `createQueryBuilder().update().set(...).where(...).execute()` stub
  returning `{ affected }` (and CI has no live MySQL, so the "two simultaneous polls" race is
  simulated, consistent with the standing no-live-DB note). This test-harness work is part of
  this issue's scope.

### Acceptance criteria

- [ ] `auth_authorization_requests` table + entity + migration exist with the columns and four
      indexes listed above; `user_id` is nullable with no physical FK.
- [ ] `POST /auth/authorization-requests.json` returns `{ uuid, pollToken, expiresAt }` with an
      identical shape and timing for a matching vs non-matching username; only `sha256(pollToken)`
      is stored; `request_ip` and `request_user_agent` are recorded.
- [ ] `expires_at` derives from `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` via `ConfigService`
      (default 1h), `Number(...)`-coerced so a real env override still produces a numeric
      millisecond offset.
- [ ] The `status` column is a native MySQL `enum('open','approved','denied','logged','expired')`
      in both the entity (`type: 'enum'`) and the migration (`default: "'open'"`).
- [ ] The cookie + `{ user, refreshToken }` response logic is extracted to a shared
      `backend/src/auth/auth-response.ts` and `AuthController` is refactored to use it, so the
      device-authorization and password-login responses share one implementation.
- [ ] IP / User-Agent parsing lives in `backend/src/core/client-request.ts` (no `.helper`
      suffix).
- [ ] `POST /auth/authorization-requests/:uuid/poll.json` returns `{ status: 'open' }` while
      waiting, flips an overdue `open` row to `expired`, and on `approved` returns
      `{ status: 'approved', user, refreshToken }` + `Set-Cookie access_token` exactly once, with
      every later/losing poll getting `{ status: 'logged' }` and no credentials.
- [ ] The `approved → logged` transition is a single guarded `UPDATE … WHERE status = 'approved'`;
      an e2e test fires two simultaneous polls and asserts exactly one credential body.
- [ ] Unknown `uuid` and wrong `pollToken` both return `404`.
- [ ] A device-authorization "logged" session equals a password-login session (same
      `TokenService.issueTokens` output).
- [ ] Both routes set `X-Skip-Cache: true`, asserted in e2e.
- [ ] `authorization-request.created` and `authorization-request.logged` events are emitted.
- [ ] `authorization-request.service.spec.ts` and `authorization-request.controller.e2e-spec.ts`
      exist and pass; backend lint passes.

## Benefits

- Delivers the requesting-device half of the password-less login flow end to end at the API
  level, verifiable without any UI.
- Establishes the atomic, enumeration-safe status machine (`open → approved → logged`, plus
  `denied` / `expired`) that sub-issues 3, 6 and 8 build on.
- Reuses the password-reset-token pattern and `TokenService`, keeping the new surface consistent
  with the module.
