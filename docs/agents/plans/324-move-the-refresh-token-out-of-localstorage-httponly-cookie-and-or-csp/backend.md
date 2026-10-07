# Backend Plan: Move the refresh token out of localStorage (httpOnly cookie and/or CSP)

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **produces** every cookie and body contract in [plan.md](plan.md#shared-contracts):

- It sets `refresh_token` (httpOnly, Secure, SameSite=Strict, `Path=/auth`, maxAge = refresh row `expiresAt - now`) and `logged_in=1` (not httpOnly, Secure, SameSite=Strict, `Path=/`, same maxAge) on login, register, refresh and the approved poll.
- It clears `access_token`, `refresh_token` and `logged_in` on logoff, on a failed refresh (`401`), and on `status` → `loggedIn: false`.
- `refreshToken` disappears from every response body and from every request DTO. The one exception is the temporary optional body fallback on `refresh.json`, used only when the cookie is absent.

## Steps

- [01 — Cookie helpers and session expiry](backend/01-cookie-helpers.md)
- [02 — Switch auth routes to the cookie](backend/02-auth-routes.md)
- [03 — Switch session, account and poll routes](backend/03-session-account-poll.md)
- [04 — Specs and docs](backend/04-specs-and-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` and `docker-compose run --rm kerghan_tests yarn lint` (CI workflow `test`)

## Notes

- `auth.service.ts` is at 298 lines (300-line limit). Put the new cookie read/write logic in `auth-response.ts` or a new `auth-cookies.ts`, never in `auth.service.ts`. Any service change there must stay net-neutral in size, or move code out.
- Controllers stay thin: they only call the cookie helpers and services.
- `OriginGuard` already covers CSRF on these `@Public()` state-changing routes. With `SameSite=Strict` and `Path=/auth` on the new cookie, no guard change is needed. Confirm it in `docs/agents/architecture/security.md`.
- The migration body fallback on `refresh.json` must be easy to remove: one clearly marked branch (`TODO(#324-migration)`), no other route accepts a body token.
- The proxy already forwards `Set-Cookie`/`Cookie` for the existing `access_token`, so no proxy change is expected. All `/auth` routes are already `CacheClass.Never`, so no Navi change is expected either.
