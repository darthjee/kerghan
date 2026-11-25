# Backend Plan: Safari cannot stay logged in to a standalone instance over plain HTTP

Main plan: [plan.md](plan.md)

## Shared contracts

- **Consumes `KERGHAN_COOKIE_SECURE`** through `ConfigService` as a string.
  - Exactly `false` → cookies are set and cleared without `secure`.
  - Anything else, including unset → `secure: true`.
- The backend has no standalone-specific logic. The standalone client decides the value.

## Implementation Steps

### Step 1 — Drive the cookies' `secure` option from `KERGHAN_COOKIE_SECURE`

In `backend/src/auth/auth-cookies.ts`:

- **Add `cookieSecure(configService)`**, a small exported helper that returns
  `configService.get<string>('KERGHAN_COOKIE_SECURE') !== 'false'`. It is the single source of the
  decision.
- **Build the cookie options from it.** Replace the fixed `BASE_OPTIONS`/`*_OPTIONS` constants with
  a builder, for example `sessionCookieOptions(secure)` returning the three option objects, so the
  set and clear paths cannot drift apart. `sameSite: 'strict'`, `httpOnly` and the `path`s stay as
  they are.
- **`setSessionCookies(res, result, configService)`** uses `cookieSecure(configService)`.
- **`clearSessionCookies(res, configService)`** gains the `configService` parameter and clears with
  the same options.
- **`clearSessionCookiesOnUnauthorized(res, token, action, configService)`** gains the parameter
  too and passes it on. Keep the argument order readable; adjust the JSDoc.
- **Update the callers** in `backend/src/auth/auth.controller.ts`: logout, refresh and `status`.
  They already hold `this.configService`.

The controllers stay thin: the decision lives in the helper.

### Step 2 — Specs and docs

**Specs.** In `backend/src/auth/tests/auth-cookies.spec.ts`:

- The existing expectations stay as they are: they cover the default `secure: true`.
- Add cases where `KERGHAN_COOKIE_SECURE` is `false`: all three cookies are set with
  `secure: false`, and cleared with `secure: false`.
- Add cases for `true`, unset and an unexpected value: all `secure: true`.
- Make the `configService` mock key-aware, returning the TTL fallback for the TTL key and the
  configured value for `KERGHAN_COOKIE_SECURE`.
- Update `backend/src/auth/tests/auth.controller.spec.ts` (and any e2e spec asserting the
  `clearSessionCookies` call shape) for the new parameter.

**Docs:**

- `docs/agents/environment-variables/backend.md`:
  - Add a `KERGHAN_COOKIE_SECURE` row: **Consumed**, optional; `false` drops `Secure` from the
    three session cookies; default `true`; set by the standalone client on loopback binds; never
    set it on a deployment reachable over a network.
  - Fix the `NODE_ENV` row's "the access-token cookie is always `Secure`…" sentence.
- `docs/agents/backend/routes/auth/shared.md` (Session cookies): "All three cookies are `Secure`"
  becomes "`Secure` unless `KERGHAN_COOKIE_SECURE=false`". `clearSessionCookies` uses the same
  setting.
- `docs/agents/modules/auth/sessions.md`: the same correction where it says the cookie is `Secure`.

## Files to Change

- `backend/src/auth/auth-cookies.ts`: the `cookieSecure` helper, the options builder, and the new
  `configService` parameters.
- `backend/src/auth/auth.controller.ts`: pass `this.configService` to the clear helpers.
- `backend/src/auth/tests/auth-cookies.spec.ts`: the `false`/`true`/unset/unexpected cases.
- `backend/src/auth/tests/auth.controller.spec.ts` (and affected e2e specs): the new call shape.
- `docs/agents/environment-variables/backend.md`, `docs/agents/backend/routes/auth/shared.md`,
  `docs/agents/modules/auth/sessions.md`: the docs.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`).
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`).
- If an e2e/DB spec is touched: `docker-compose run --rm kerghan_db_tests` (CI job:
  `backend_db_tests`).

## Notes

- **Fail safe:** only the exact string `false` turns `Secure` off, so a typo keeps the safe
  behaviour.
- **Request a `security` agent review** on the PR: it touches cookies and sessions.
