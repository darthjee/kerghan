# Issue: Fix login flow

## Problem
- Backend and frontend auth routes are misaligned, and the routes are not documented anywhere.
- `AccountsClient.register` (`frontend/assets/js/client/AccountsClient.js`) already exists but
  posts to the wrong path, `/accounts/register.json`, instead of the backend's actual
  `/auth/register.json` — registration is currently broken end-to-end.
- There is no Login, Logout, or token-refresh code anywhere in the frontend: no client methods,
  no pages, no controllers.
- The backend's logout route, `POST /auth/logout.json`, doesn't follow the intended REST shape;
  it should be `DELETE /auth/logoff.json`.
- `Header.jsx` currently carries a docstring stating auth-awareness is explicitly out of scope —
  that note is now superseded, since a working Logout needs somewhere to live in the nav.

## Expected Behavior
- Registration works end-to-end (frontend calls the correct backend route).
- Users can log in and log out from the frontend, with the access-token cookie transparently
  refreshed on expiry and the session gracefully ending (redirect to Login) when the refresh
  token itself is no longer valid.
- All auth routes (frontend and backend) are aligned and documented in one place.

## Solution

### Routes
- POST /auth/login.json
- DELETE /auth/logoff.json (renamed from POST /auth/logout.json)
- POST /auth/refresh.json
- POST /auth/register.json

### Backend
- Rename `POST /auth/logout.json` -> `DELETE /auth/logoff.json`. Removed outright, no deprecated
  alias: no working frontend caller exists yet for the old route, so there's nothing to keep
  backward-compatible.
- Extend the access-token expiry from 15 minutes to 1 hour, and make it configurable via a new
  env var, `KERGHAN_ACCESS_TOKEN_TTL_MS`, read through `ConfigService` rather than `process.env`
  directly (matching this codebase's existing pattern).
- **This must be applied in two places, kept in sync from the same env var** — extending only
  one leaves the token effectively expiring after the shorter of the two:
  - `app.module.ts:46`'s `JwtModule.registerAsync` `signOptions: { expiresIn: '15m' }` — this is
    what actually governs the signed JWT's own validity, independent of the cookie.
  - `auth.controller.ts`'s `ACCESS_TOKEN_MAX_AGE_MS` constant, used as the `access_token`
    cookie's `maxAge`.
- Document the new env var in `docs/agents/environment-variables.md`.

### Frontend
Build the frontend auth flow end to end, not just fixing Register's URL:
- Fix `AccountsClient.register`'s URL to `/auth/register.json`.
- Add a Login page + client method (mirroring the existing Register page/controller/helper
  structure under `frontend/assets/js/components/resources/accounts/pages/`).
- Add Logout (client method + trigger point) and refresh-token handling.
- Token storage: the access token is already handled server-side as an httpOnly cookie
  (auto-sent by the browser) — the frontend never touches it directly. The refresh token,
  returned in the login/register/refresh JSON response body, is persisted in `localStorage` so
  it survives reloads and new tabs.
- `Header.jsx`'s nav becomes auth-aware: it shows Login when logged out and a Logout action when
  logged in. This lifts the previous "auth-awareness out of scope" note.
- Refresh trigger: reactive. `ApiClient` calls `/auth/refresh.json` when a request comes back
  `401` (access token expired), then retries the original request once. No proactive timers.

### Edge cases
- **Refresh token invalid/expired** (`refresh.json` itself returns 401): clear the stored
  refresh token and any in-memory auth state, then redirect to the Login page/route ("session
  expired" handling).
- **401-retry guard**: `ApiClient` retries a request at most once after a refresh. If the
  retried request also comes back 401, treat it as the refresh-failure case above rather than
  retrying again (avoids infinite retry loops).

### Testing strategy
- Backend (Jest, under `backend/src/auth/tests/`): cover the `logout.json` -> `logoff.json`
  rename (route/method, cookie clearing) and the configurable access-token `maxAge` (env var
  present vs. default) in `auth.controller.spec.ts` (new) and/or `auth.service.spec.ts`.
- Frontend (Jasmine, mirroring `frontend/specs/assets/js/...` structure): add specs for the new
  Login page/controller/helper (mirroring `RegisterSpec.js` / `RegisterControllerSpec.js` /
  `RegisterHelperSpec.js`), the fixed `AccountsClient.register` URL, new `AccountsClient`
  login/logout/refresh methods, the `ApiClient` 401-retry-with-refresh behavior, and Header's new
  auth-aware rendering (logged-in vs. logged-out states).

### Documentation
Update the existing docs in place rather than creating new ones:
- `docs/agents/modules/auth.md` and `docs/agents/backend/routes/auth.md` — reflect the
  `logout.json` -> `logoff.json` rename (route, method, DTO reuse) and the new configurable
  access-token expiry (replace the hardcoded "15 minute expiry" mentions with a reference to
  `KERGHAN_ACCESS_TOKEN_TTL_MS`).
- Add a frontend-side section/page documenting the new Login/Logout/refresh flow (no such doc
  exists yet for the frontend auth flow).

## Benefits
- Registration, login, and logout actually work from the frontend.
- Auth routes are consistent and documented, removing the current backend/frontend drift.
- Access-token lifetime is configurable per environment instead of hardcoded.
