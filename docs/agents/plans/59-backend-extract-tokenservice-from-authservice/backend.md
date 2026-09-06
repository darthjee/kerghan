# backend Plan: Backend: extract TokenService from AuthService

Main plan: [plan.md](plan.md)

## Overview

Move session minting out of `AuthService` into a new injectable `TokenService` in the Auth
module, so #58 sub-issue 2's `AuthorizationRequestService` can mint a login session identical to
a password login without duplicating the logic, and so `auth.service.ts` (currently exactly 300
lines — the ESLint `max-lines` ceiling) has room for the follow-on work. Pure,
behaviour-preserving refactor: no endpoint, schema, response, cookie, or event change.

## Context

- `backend/src/auth/auth.service.ts:254` `#issueTokens(user)` signs the access-token JWT
  (`jwtService.sign({ sub, username, isAdmin })`), persists a SHA-256-hashed `RefreshToken` row
  (7-day TTL via `REFRESH_TOKEN_TTL_MS`, `revokedAt: null`), then writes an `auth_sessions`
  bookkeeping row via `#touchSession` (`:283`).
- `#hashToken` (`:242`, `createHash('sha256')…digest('hex')`) is shared: besides `#issueTokens`
  it backs the refresh-token *read* paths `#findActiveRefreshToken` (`:222`), `logout` (`:161`),
  and `#findActiveTokenRow` (`:246`).
- `AuthResult` interface (`:26`) is declared in `auth.service.ts` and imported by
  `auth.controller.ts:4` (`import { AuthResult, AuthService } from './auth.service.js'`).
- After moving the mint path, `AuthService` no longer uses `JwtService` at all, and
  `@InjectRepository(Session) sessionRepository` becomes unused there (only `#touchSession` used
  it). `refreshTokenRepository`, `userRepository`, `eventEmitter`, `passwordResetService` all
  stay.
- Precedent: `backend/src/auth/password-reset.service.ts` — an internal Auth-module collaborator,
  `@Injectable()`, in `providers` but **not** in `exports`, extracted for exactly this
  line-limit reason.
- `backend/src/auth/tests/auth.controller.e2e-spec.ts` imports the real `AuthModule` and only
  overrides the four repository providers (`.overrideProvider(getRepositoryToken(...))`), so it
  picks up a new `TokenService` provider automatically — **it must pass untouched** and is the
  behaviour-drift guard.
- `backend/src/auth/tests/auth.service.spec.ts:47` builds the service by hand with a positional
  constructor: `new AuthService(userRepo, refreshTokenRepo, sessionRepo, jwtService,
  eventEmitter, passwordResetService)` and asserts `sessionRepository.save(...)` (~`:101`) — this
  spec must be updated to the new constructor shape.
- `AGENT_SPLIT=false`, single owner `backend` (pure NestJS/TypeORM/Jest change inside
  `backend/src/auth/`). `security` / `data-access` are read-only reviewers with no implementation
  work here.

## Implementation Steps

### Step 1 — Extract TokenService and rewire AuthService + AuthModule

- New `backend/src/auth/token.service.ts`:
  - `@Injectable() export class TokenService`, constructor-injecting
    `@InjectRepository(RefreshToken) refreshTokenRepository`, `@InjectRepository(Session)
    sessionRepository`, and `JwtService` — same field-assignment style as the other Auth
    services.
  - Move `REFRESH_TOKEN_TTL_MS` and `#touchSession` here verbatim; move `#issueTokens` here as a
    **public** `issueTokens(user: User): Promise<AuthResult>` (body unchanged).
  - Move `AuthResult` here as its canonical declaration.
  - Add a **public** `hashToken(token: string): string` (the `createHash('sha256')` one-liner).
    The issue says "moved verbatim as private", but `AuthService`'s three read paths still need
    SHA-256 hashing; exposing one shared `hashToken` and routing every caller through it is the
    DRY reading of the issue's "the two paths cannot drift". Retaining a 3-line private
    `#hashToken` in `AuthService` instead is an acceptable fallback if a reviewer objects to the
    coupling — the rest of the plan assumes the public method.
  - Move the `randomBytes` / `createHash` imports out of `auth.service.ts` into this file.
- `backend/src/auth/auth.service.ts`:
  - Inject `TokenService`; delete the `JwtService` and `@InjectRepository(Session)
    sessionRepository` constructor params, fields, and their JSDoc `@param` lines.
  - Replace `this.#issueTokens(user)` at its 3 call sites (`register` `:100`, `login` `:112`,
    `refresh` `:151`) with `this.tokenService.issueTokens(user)`.
  - Replace `this.#hashToken(...)` at its 3 read-path call sites (`#findActiveRefreshToken`,
    `logout`, `#findActiveTokenRow`) with `this.tokenService.hashToken(...)`.
  - Delete `#issueTokens`, `#touchSession`, `#hashToken`, and `REFRESH_TOKEN_TTL_MS`; drop the
    `randomBytes` / `createHash` import and the `JwtService` import.
  - Re-export the type for import stability:
    `export type { AuthResult } from './token.service.js';` — so `auth.controller.ts`'s import
    is untouched.
  - Confirm `auth.service.ts` is now comfortably under 300 lines.
- `backend/src/auth/auth.module.ts`: add `TokenService` to `providers`. `TypeOrmModule.forFeature`
  is unchanged (`Session` is still registered — now used by `TokenService`). Do **not** add
  `TokenService` to `exports` (internal collaborator, same as `PasswordResetService`).

### Step 2 — Tests

- New `backend/src/auth/tests/token.service.spec.ts` (unit; mocked `RefreshToken` repo,
  `Session` repo, `JwtService`; mirror `password-reset.service.spec.ts` style):
  - `issueTokens(user)` returns `{ user, accessToken, refreshToken }`; `accessToken` comes from
    `jwtService.sign({ sub: user.id, username: user.username, isAdmin: user.isAdmin })`; a
    `RefreshToken` row is saved with `tokenHash === hashToken(refreshToken)`,
    `expiresAt ≈ now + 7d`, `revokedAt: null`; an `auth_sessions` row is saved with
    `{ userId: user.id, lastSeenAt: <Date> }`.
  - `hashToken(value)` returns a stable SHA-256 hex digest (compare against a known vector).
- `backend/src/auth/tests/auth.service.spec.ts`:
  - Replace the `sessionRepository` + `jwtService` positional constructor args with a
    `tokenService` mock: `issueTokens` resolves a canned `AuthResult`, `hashToken` returns a
    deterministic hex string.
  - Move the `sessionRepository.save` expectation (~`:101`) to `token.service.spec.ts`; in this
    file it becomes `expect(tokenService.issueTokens).toHaveBeenCalledWith(user)`.
  - Keep every behaviour assertion that still belongs to `AuthService`: bad-credential
    `UnauthorizedException`, `refresh` revokes the presented row before issuing,
    replay-of-revoked triggers `#revokeTokenFamily`, `resetPassword` revokes the family,
    `status` mutates nothing.
- `auth.controller.e2e-spec.ts`, `auth.controller.spec.ts`, `admin.service.spec.ts`,
  `admin.controller.e2e-spec.ts` — **no changes**; they must stay green as the behaviour-drift
  guard.

## Files to Change

- `backend/src/auth/token.service.ts` — new: `TokenService` (`issueTokens`, `hashToken`,
  `#touchSession`), `AuthResult`, `REFRESH_TOKEN_TTL_MS`, `randomBytes`/`createHash` imports.
- `backend/src/auth/auth.service.ts` — inject `TokenService`; delete `#issueTokens` /
  `#touchSession` / `#hashToken` / `REFRESH_TOKEN_TTL_MS`; drop `JwtService` + `Session` repo
  constructor deps and their imports; re-export `AuthResult`.
- `backend/src/auth/auth.module.ts` — add `TokenService` to `providers`.
- `backend/src/auth/tests/token.service.spec.ts` — new unit spec.
- `backend/src/auth/tests/auth.service.spec.ts` — update to the new constructor shape; relocate
  the session-write assertion.

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests` — runs `npm run coverage`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks` — runs `npm run lint`)

## Notes

- Behaviour must not change: same JWT payload and TTL, same 7-day refresh-token TTL, same
  SHA-256 hashing, same `auth_sessions` row written on every login / register / refresh, same
  `{ user, refreshToken }` body + `Set-Cookie access_token`. `auth.controller.e2e-spec.ts`
  passing untouched is the proof.
- The only judgment call is `hashToken` visibility — public on `TokenService` (chosen: DRY, and
  matches "the two paths cannot drift") vs. a retained 3-line private copy in `AuthService`.
- No migration, no config key, no frontend, no docs change here — #58 sub-issue 9 owns the docs
  sync.
- `AuthResult` is re-exported from `auth.service.ts` so no other file's imports change; moving it
  outright and updating `auth.controller.ts:4` is an equivalent alternative.
