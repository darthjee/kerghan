# Issue: Frontend: My account Authorizations page

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issue 3 (approver-side endpoints: `mine` / `authorize` / `deny`, delivered in #61).

This is the approving-device UI: a "My account → Authorizations" page at
`#/account/authorization-requests` where a logged-in user reviews the authorization requests
raised against their username and approves (with their password) or denies each.

Follow the existing `AdminUsers` page precedent
(`components/resources/admin/pages/AdminUsers.jsx` + `controllers/` + `helpers/`,
`client/AccountsClient.js`) for structure and for auth handling: no client-side session check —
the page always fires its list call, and an unauthenticated `401` is handled by `ApiClient`'s
existing refresh/login-modal flow, exactly as `AdminUsers` relies on it today.

## Problem

- There is no UI for the vouching device; the sub-issue 3 endpoints (`mine` / `authorize` / `deny`,
  live since #61) are unreachable from the app.
- The user needs to see the recorded IP + User-Agent to sanity-check that a pending request is
  really them before authorizing.

## Expected Behavior

- `#/account/authorization-requests` lists the caller's own `open` requests, each showing the
  recorded IP, User-Agent, and age. Empty state when there are none.
- Per row: **Authorize** reveals an inline password field and calls
  `AccountsClient.authorizeAuthorizationRequest(uuid, password)`; **Deny** calls
  `AccountsClient.denyAuthorizationRequest(uuid)` with no password. The list reloads after either.
- A `400` (wrong password / already resolved) shows a generic inline error; the row stays.
- The header shows a "My account" dropdown, containing an "Authorizations" link, when logged in.
- The page performs no client-side login check: it always attempts to load the list; a logged-out
  caller gets a `401` from `mine.json`, which `ApiClient` turns into the existing login-modal flow
  (same as the `AdminUsers` precedent) — there is no separate "please log in" prompt.

## Solution

### Scope

The page component trio, its route + `PAGES` entry, the new header dropdown, and the three
`AccountsClient` methods. Mirrored Jasmine specs.

Explicitly **out of scope**:

- Any backend change (sub-issue 3/#61 already owns the endpoints).
- Real-time updates / auto-refresh — the user reloads manually.
- Rate-limiting copy — #58 sub-issue 8.

### What needs to be done

- New `components/resources/accounts/pages/AuthorizationRequests.jsx` (+ `controllers/AuthorizationRequestsController.js`
  + `helpers/AuthorizationRequestsHelper.jsx`), following the `AdminUsers` trio shape:
  - Controller: `load()` → `AccountsClient.listAuthorizationRequests()`, called unconditionally on
    mount (no session check — a logged-out `401` is handled entirely by `ApiClient`); `authorize(uuid,
    password)` / `deny(uuid)` → call the client, then `load()` again; expose an error string on a
    thrown `ApiError`.
  - Helper: table/list of rows with IP + User-Agent + age; per-row Authorize (inline password
    input + confirm) and Deny buttons; empty + error states.
- `frontend/assets/js/client/AccountsClient.js` — add:
  - `listAuthorizationRequests()` → `POST /auth/authorization-requests/mine.json {}` →
    `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }`.
  - `authorizeAuthorizationRequest(uuid, password)` →
    `POST /auth/authorization-requests/${uuid}/authorize.json { password }` →
    `{ authorized: true }`.
  - `denyAuthorizationRequest(uuid)` →
    `POST /auth/authorization-requests/${uuid}/deny.json {}` → `{ denied: true }`.
  (None touch `AuthSession`.)
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — add
  `['/account/authorization-requests', 'authorization-requests']` (before `['/', 'home']`).
- `frontend/assets/js/components/helpers/AppHelper.jsx` — `PAGES['authorization-requests']` →
  `<AuthorizationRequests />`.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — when logged in, render a
  new "My account" `NavDropdown` (the header's first such grouping, meant to hold future account
  pages too) with a single `NavDropdown.Item href="#/account/authorization-requests"` labeled
  "Authorizations".
- Specs (Jasmine + c8), mirrored under `frontend/specs/`: `AuthorizationRequestsSpec.js`,
  `AuthorizationRequestsControllerSpec.js` (load / authorize / deny / reload / error on wrong
  password), `AuthorizationRequestsHelperSpec.js`, `AccountsClientSpec.js` extended,
  `HeaderHelperSpec.js` updated (dropdown + link shown when logged in).

### Acceptance criteria

- [ ] `#/account/authorization-requests` lists the caller's own `open` requests with recorded IP
      + User-Agent, and an empty state when there are none.
- [ ] Authorize requires an inline password and calls
      `authorizeAuthorizationRequest(uuid, password)`; Deny calls
      `denyAuthorizationRequest(uuid)` with no password; the list reloads after each.
- [ ] A `400` shows a generic inline error and leaves the row in place.
- [ ] The header shows a "My account" dropdown, containing the "Authorizations" link, only when
      logged in.
- [ ] The page issues no client-side login check; a logged-out visit relies on `mine.json`'s `401`
      to open the login modal.
- [ ] The three new `AccountsClient` methods hit the sub-issue 3 routes and are spec'd.
- [ ] New/updated Jasmine specs pass; frontend lint and tests pass.

## Benefits

- Makes the device flow usable end to end from a browser: raise on one device, approve on
  another.
- Surfaces the recorded IP + User-Agent so the approver can catch a request they did not make.
- Reuses the `AdminUsers` page and client patterns, so the new page fits the codebase.
- Establishes a "My account" header grouping that later account-related pages can join.
