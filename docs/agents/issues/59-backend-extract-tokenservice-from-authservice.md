## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on nothing — this is the prep step that unblocks #58 sub-issue 2.

The device-authorization flow (#58) must mint a login session that is byte-for-byte identical to a
password login: the same JWT `access_token` cookie, the same rotating refresh token persisted as a
SHA-256 hash in `auth_refresh_tokens`, and the same `auth_sessions` bookkeeping row. Today that
logic is private to `AuthService` (`backend/src/auth/auth.service.ts`): `#issueTokens(user)`,
`#touchSession(userId)` and `#hashToken(token)`. It cannot be reused by a second service without
either duplicating it or making it public on `AuthService`.

`backend/src/auth/auth.service.ts` is also already at the project's 300-line ESLint `max-lines`
limit, so nothing new can be added to it without a refactor first (this is exactly why
`PasswordResetService` was previously split out).

## Problem

- Session minting (`#issueTokens` / `#touchSession` / `#hashToken`) is private to `AuthService`
  and not reusable by the forthcoming `AuthorizationRequestService`.
- `auth.service.ts` is at the `max-lines` limit; adding a collaborator or a new method there
  fails lint.
- Duplicating the token-minting logic in a second service would risk the two paths drifting
  (different TTLs, different hashing, a missing `auth_sessions` row).

## Expected Behavior

- A new injectable `TokenService` owns session minting. `AuthService` delegates to it; behaviour
  is unchanged — `POST /auth/login.json`, `/auth/register.json` and `/auth/refresh.json` return
  the exact same response shape, set the same cookie, and write the same rows as before.
- `TokenService` is exported from (or otherwise injectable within) `AuthModule` so a second
  service in the module can depend on it.
- `auth.service.ts` is back under 300 lines.

## Solution

### Scope

A pure, behaviour-preserving refactor inside `backend/src/auth/`. No new endpoints, no schema
change, no response change.

Explicitly **out of scope**:

- Any authorization-request entity, endpoint, or frontend work (later #58 sub-issues).
- Changing token TTLs, the JWT payload, the refresh-token rotation policy, or the
  `auth_sessions` semantics.

### What needs to be done

- New `backend/src/auth/token.service.ts` — `@Injectable() TokenService` with a public
  `issueTokens(user: User): Promise<AuthResult>` plus private `#touchSession` / `#hashToken`,
  moved verbatim from `AuthService`. Keep the `AuthResult` interface where the rest of the module
  already imports it from (re-export if needed to avoid churn).
- `backend/src/auth/auth.service.ts` — remove the moved privates; inject `TokenService`; replace
  internal `this.#issueTokens(user)` calls with `this.tokenService.issueTokens(user)`.
- `backend/src/auth/auth.module.ts` — register `TokenService` as a provider (and `exports` it if
  the classification pattern calls for module-external reuse; sub-issue 2's service is in the
  same module, so provider registration is enough).
- Tests: new `backend/src/auth/tests/token.service.spec.ts` covering token minting, hashing, and
  the `auth_sessions` insert; update `auth.service.spec.ts` mocks to inject a fake `TokenService`;
  keep `auth.controller.e2e-spec.ts` green unchanged (proves no behaviour drift).

### Acceptance criteria

- [ ] `TokenService.issueTokens(user)` produces the same `{ user, accessToken, refreshToken }`
      shape `AuthService` produced before, with the same TTLs and the same SHA-256 refresh-token
      hashing.
- [ ] A new `auth_sessions` row is still written on every login / register / refresh.
- [ ] `AuthService` no longer defines `#issueTokens` / `#touchSession` / `#hashToken`; it injects
      `TokenService`.
- [ ] `backend/src/auth/auth.service.ts` is under 300 lines.
- [ ] `token.service.spec.ts` exists; `auth.service.spec.ts` and `auth.controller.e2e-spec.ts`
      pass unchanged in intent.
- [ ] `docker-compose run --rm kerghan_tests yarn test` and the backend lint pass.

## Benefits

- Makes session minting reusable by the device-authorization flow without duplicating it, so the
  password-login and device-login paths cannot drift.
- Brings `auth.service.ts` back under the line limit, unblocking every later backend sub-issue.
- Isolated, low-risk change that can land and be verified before any feature work starts.
