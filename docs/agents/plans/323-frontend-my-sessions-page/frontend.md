# Frontend Plan: Frontend: My sessions page

Main plan: [plan.md](plan.md)

## Overview
Build the Sessions page by mirroring the existing `AuthorizationRequests` page (page component + controller + render helper, client methods on `AccountsClient`), then wire it into routing and the "My account" dropdown.

## Context
The backend (#322, `backend/src/auth/session.controller.ts`) exposes, all `POST`, authenticated, with the current `refreshToken` in the body:
- `/auth/sessions/mine.json` → `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }`, most recently used first; an unknown token marks no session `current`.
- `/auth/sessions/:uuid/revoke.json` → `{ revoked: true }`; `404` for an unknown/foreign id, `400` for a malformed id.
- `/auth/sessions/revoke-others.json` → `{ revoked: true }`; `401` and nothing revoked when the current token is missing/invalid.

Decisions from the issue: route `#/account/sessions`, menu label **Sessions**; dates shown as absolute local date-times; per-row **Revoke** fires directly and is not rendered on the current row; **Sign out all other sessions** requires a confirmation step and is not offered when no session is `current`.

## Steps

- [01 — Add session client methods](frontend/01-client-methods.md)
- [02 — Add SessionsController](frontend/02-sessions-controller.md)
- [03 — Add Sessions page and render helper](frontend/03-sessions-page.md)
- [04 — Wire route and menu entry](frontend/04-route-and-menu.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- `ApiClient` treats any `401` as an expired access token: it refreshes once with the stored token, and on failure opens the login modal and returns `undefined`. That is why revoke-others must not be offered without a `current` session — it would 401 and log the user out of the UI.
- Revoking a session only revokes its refresh token; the other device's access token stays valid until it expires (backend behavior, nothing to do here).
- Never cached / `X-Skip-Cache` is handled server-side and by the existing `ApiClient`; no Navi change is needed since the endpoints are user-scoped `POST`s.
- Follow the existing JSDoc density and the `buildLoadEffect` / `renderCapturingHandlers` testing patterns of `AuthorizationRequests`.
