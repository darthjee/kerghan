# Issue: Refactor: dedupe login/register request boilerplate and spec headers across auth.controller e2e specs

## Description
The `auth.controller.*.e2e-spec.ts` files (and `admin.controller.e2e-spec.ts`) repeat both the file header and the same login/register request many times.

## Problem
- Identical 16-line file headers (imports, `describe('AuthController (e2e)')`, `buildTestApp()` in `beforeEach`, `app.close()` in `afterEach`) in `auth.controller.login.e2e-spec.ts`, `auth.controller.guard.e2e-spec.ts` and `auth.controller.skip-cache.e2e-spec.ts` (jscpd, lines 1-16 in each pair); the same scaffold is also present in `recovery`, `account`, `refresh-logout` and `admin`.
- `post('/auth/login.json').send({ username: 'darthjee', password: 'my-password' })` appears 7 times in `auth.controller.refresh-logout.e2e-spec.ts`, 4 in `login`, 3 in `skip-cache`, 2 each in `recovery`, `account`, and `admin.controller.e2e-spec.ts`, and once in `guard`.
- `auth.controller.refresh-logout.e2e-spec.ts` ↔ `auth.controller.skip-cache.e2e-spec.ts`: three clones totalling 29 lines (login + refresh/logout call, e.g. 58-68 ↔ 35-58, 133-143 ↔ 35-88).
- Local, one-off cookie-extraction helpers are duplicated: `loginCookie()` in `account`, `registerAndLogin()` in `admin`, plus inline `set-cookie[0].split(';')[0]` in `guard`, `account` and `admin`.
- A `login(app, username, password)` helper returning the access-token cookie already exists in `authorization-request.controller.e2e-test-support.ts` (alongside a `useTestApp()` that registers the `beforeEach`/`afterEach` scaffold), but nothing equivalent exists in `auth.controller.e2e-test-support.ts`.

## Expected Behavior
`auth.controller.e2e-test-support.ts` exposes:
- `loginAs(app, username = 'darthjee', password = 'my-password')` — returns the full supertest response (body with `refreshToken`, headers).
- `loginCookie(app, username?, password?)` — built on `loginAs`, returns the `access_token=...` cookie string ready for `.set('Cookie', [cookie])`.
- `registerUser(app, { username, email, password? })` — wraps `POST /auth/register.json`.
- `useTestApp(options?)` — getter-based helper (in the spirit of the one in `authorization-request.controller.e2e-test-support.ts`) that registers the `beforeEach`/`afterEach` scaffold and forwards `buildTestApp` options (`adminGuard`, `registerDefaultUser`); it exposes `app` and the in-memory repos the specs need.

All auth e2e specs use them. Test behavior is unchanged.

## Solution
- Add the helpers above (sharing the existing `login()` implementation with the authorization-request support where possible, e.g. via `support/`; coordinate with the `buildTestApp` consolidation).
- Apply `useTestApp()` to all seven specs that carry the standard scaffold: `login`, `guard`, `skip-cache`, `recovery`, `account`, `refresh-logout` and `admin`.
- Replace the inline login/register request blocks with `loginAs` / `loginCookie` / `registerUser`, and drop the local `loginCookie()` (`account`) and `registerAndLogin()` (`admin`) helpers in favour of the shared ones.
- Keep `auth.controller.skip-cache.e2e-spec.ts` as a dedicated file documenting the `X-Skip-Cache` contract, but shrink it with the shared helpers (no folding of its assertions into the per-route specs).

## Benefits
Cuts a large amount of repeated request code and makes the intent of each e2e case visible at a glance.
