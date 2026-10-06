# Issue: Frontend: My sessions page

## Description
Part of #318 — "Keep me signed in". The UI for listing and revoking the caller's own active sessions.

**Depends on:** #322 (Backend: list & revoke sessions API), already merged.

## Problem
The backend (#322) now exposes the session list/revoke API, but users have no way to reach it: there is no page showing where they are signed in, nor a way to cut off a session they no longer trust. Long-lived "keep me signed in" sessions make this more important.

## Expected Behavior
A logged-in user opens **My account → Sessions**, sees their active sessions (the current one clearly marked), and can revoke any other single session or sign out every other session at once.

## Solution
### Backend contract (from #322, `SessionController`)
All `POST`, authenticated, never cached; the current `refreshToken` (from `AuthSession`) goes in the body:
- `POST /auth/sessions/mine.json` → `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }`, most recently used first. An unknown token marks no session as `current` (no error).
- `POST /auth/sessions/:uuid/revoke.json` → `{ revoked: true }`; `404` for an unknown/foreign id.
- `POST /auth/sessions/revoke-others.json` → `{ revoked: true }`; `401` and nothing revoked when the current token is missing/invalid.

### Client
- New `AccountsClient` methods (`listSessions`, `revokeSession(uuid)`, `revokeOtherSessions`), each sending `refreshToken: AuthSession.get()`, following the existing `listAuthorizationRequests`/`denyAuthorizationRequest` pattern (falsy result = session expired, `ApiClient` already opened the login modal).

### Page
- Route `#/account/sessions` in `HashRouteResolver`, and a **Sessions** entry in the "My account" dropdown (`HeaderHelper`) alongside Authorizations / Integrations / Account.
- `Sessions` page + `SessionsController` + `SessionsHelper`, mirroring the `AuthorizationRequests` page structure (controller with `load`, per-row action state and error, list reload after a successful action).
- Table of sessions: started at, last used (both as absolute date-times in the browser's locale/timezone), a "keep me signed in" marker, and a "current session" badge on the current one.
- Actions:
  - **Revoke** per row — fires directly, no confirmation; not rendered on the current session (logout covers it).
  - **Sign out all other sessions** — a page-level button behind a confirmation step. Hidden/disabled when no session is marked `current` (the stored token is unknown to the backend, which would answer `401` and push the user into the login modal).
  - After a successful action, the list is reloaded; a failure shows the error (per row for revoke, at page level for revoke-others).
- Empty/loading/error states follow the existing account pages.

### Testing
Jasmine specs for: client methods (body carries the refresh token), list rendering, current and keep-signed-in markers, revoke button absent on the current row, revoke-others hidden/disabled with no current session and gated by its confirmation, both revoke actions (success reloads, failure shows the error), and the menu entry/route.

### Agents
frontend.

## Benefits
Users can see where they are signed in and revoke sessions they no longer trust, closing the "Keep me signed in" epic (#318) on the user-facing side.
