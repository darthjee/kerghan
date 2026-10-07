# Issue: Move the refresh token out of localStorage (httpOnly cookie and/or CSP)

## Description
Spawned from #319 ("Keep me signed in" sessions), which makes refresh tokens potentially long-lived (renewing 30-day window by default). The frontend keeps the refresh token in `localStorage` and sends it in request bodies. This issue moves it into an httpOnly cookie that page scripts cannot read. Adding a Content-Security-Policy is tracked separately in #331.

## Problem
The frontend stores the refresh token in `localStorage` (`frontend/assets/js/client/AuthSession.js`) and sends it in request bodies to every `/auth` endpoint that needs it: `refresh`, `logoff`, `status`, `account` (password change), `sessions/mine` and `sessions/revoke-others`. Login, register, refresh and the device-authorization `poll` return it in the response body. Any script running on the page can read it. An XSS bug would therefore let an attacker exfiltrate a refresh token and keep renewing it — up to 7 days today, indefinitely for a "keep me signed in" session while it keeps being refreshed.

The access token is already an httpOnly, `Secure`, `SameSite=Strict` cookie.

## Expected Behavior
- The refresh token is never readable by page scripts, never stored in `localStorage`, and never sent in request or response bodies (apart from the one-time migration fallback below).
- Login, register, refresh and the approved device-authorization poll set a `refresh_token` cookie: `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth` (every consuming endpoint lives under `/auth`). Its lifetime matches the token's server-side expiry: 7 days for a regular session, the renewing window for a "keep me signed in" session.
- `refresh`, `logoff`, `status`, `account` and `sessions/mine` / `sessions/revoke-others` read the token from the cookie. The "current session identified by the refresh token" convention from the #318 sub-issues now means "identified by the `refresh_token` cookie". `refreshToken` is removed from the DTOs and from response bodies.
- Alongside it, the backend sets a non-secret, script-readable `logged_in=1` hint cookie with the same lifetime and clears it together with the refresh cookie. The frontend uses it only for the optimistic initial render (Header) and still confirms the state through `status.json`.
- `logoff` and any refresh/status failure that means the session is gone clear `access_token`, `refresh_token` and `logged_in`.
- **Migration:** on load, if `localStorage` still holds `kerghan_refresh_token`, the frontend calls `refresh.json` once with it in the body. As a temporary fallback, `refresh.json` accepts the body token only when no `refresh_token` cookie is present. The response sets the cookies, and the frontend then deletes the `localStorage` key whatever the outcome. The body fallback is marked for removal in a later cleanup.

## Solution
- **Backend (`backend/src/auth`)**: extend `respondWithSession` (`auth-response.ts`) to set `refresh_token` and `logged_in` and stop returning `refreshToken`. Add a shared helper that reads the refresh token from the request cookie and another that clears all auth cookies. Switch `AuthController` (`refresh`, `logout`, `status`, `updateAccount`), `SessionController` (`mine`, `revokeOthers`) and `AuthorizationRequestController` (`poll`) to cookie-based access. Keep controllers thin, with logic in the services and helpers. Update the specs and e2e specs.
- **Frontend (`frontend/assets/js/client`)**: replace `AuthSession`'s token storage with a reader for the `logged_in` hint cookie plus the one-time localStorage migration. Drop `refreshToken` from the `AccountsClient` request bodies and response handling (`register`, `login`, `refresh`, `logout`, `status`, account update, sessions, poll). Make sure requests to `/auth` send cookies. Update `Header` and the Jasmine specs.
- **Proxy / cache warmer**: confirm the proxy forwards `Set-Cookie` and `Cookie` for `/auth`. All of these routes are already `CacheClass.Never`, so no Navi change is expected; verify anyway.
- **Docs**: update the auth/session sections of `docs/agents/specs.md` and the module docs.

## Benefits
- An XSS bug can no longer steal a long-lived ("keep me signed in") refresh token. The token stays bound to the browser's cookie jar.
- One credential-transport model for the whole app, matching the access-token cookie that already exists.
- Existing sessions survive the migration without forcing users to sign in again.
