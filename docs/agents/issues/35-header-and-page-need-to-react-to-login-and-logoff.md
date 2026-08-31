# Issue: Header and page need to react to login and logoff

## Description
We need the header and page to react to login and logout events, hiding/showing the
Login, Register, Logoff (and a placeholder Recover) link — and any future auth-gated
links — based on the current auth state, instead of only updating as a side effect of a
full page reload.

## Problem
`Header.jsx` holds no state and reads `AuthSession.isLoggedIn()` inline at render time
(`Header.jsx:25`). This only "works" today because every login/logout flow happens to
redirect (`window.location.hash = '/'`), forcing a full re-render of the tree — it
breaks for any future auth transition that doesn't redirect (e.g. an in-page login
modal), and gives no way for other components anywhere else in the app to know "auth
just changed" independently of the header.

Separately, `HeaderHelper.render` renders the Register link unconditionally
(`HeaderHelper.jsx:24`), outside the `isLoggedIn` branch — so it never actually hides
when logged in today, despite the issue asking for Login/Register/Logoff to all
show/hide correctly.

## Expected Behavior
- Logged out: Login, Register, and a Recover placeholder link are shown; Logoff is hidden.
- Logged in: Logoff is shown; Login, Register, and Recover are hidden.
- These transitions happen reactively wherever the auth state actually changes (login
  success, logout, and a mount-time status confirmation) — not only as a side effect of
  a full-page redirect.
- Any other component in the app (present or future) can independently react to an
  auth-state change with zero coupling to the header.

## Solution

### Core mechanism

Adopt a shared-event pattern (proven in a sibling app, Majora) instead of the current
"read `AuthSession.isLoggedIn()` inline at render time" approach in `Header.jsx`.

**New `AuthEvents` module** — a static class wrapping a single `window` `CustomEvent`,
following the same static-methods-only convention as `AuthSession`. Lives alongside it at
`frontend/assets/js/client/AuthEvents.js`:

```js
const AUTH_CHANGED_EVENT = 'auth:changed';

export default class AuthEvents {
  static emit(loggedIn) {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { loggedIn } }));
  }
  static subscribe(handler) { window.addEventListener(AUTH_CHANGED_EVENT, handler); }
  static unsubscribe(handler) { window.removeEventListener(AUTH_CHANGED_EVENT, handler); }
}
```

**`Header.jsx` becomes stateful**: `useState(AuthSession.isLoggedIn())` for the initial
value. A new hook, `frontend/assets/js/components/common/header/hooks/useAuthEffect.js`
(first `hooks/` folder in this codebase — mirrors Majora's `useHeaderAuthEffect.js`
placement), subscribes to `AuthEvents` in a mount-time `useEffect` and calls
`setLoggedIn` on change, unsubscribing in the cleanup. Any other component anywhere in
the app can independently `AuthEvents.subscribe` the same way, with zero coupling to
`Header`.

**Emit sites** (mount-time backend status check is a separate concern — see below):
- `LoginController.handleSubmit` — after `this.client.login(fields)` succeeds, call
  `AuthEvents.emit(true)` alongside the existing redirect.
- `HeaderController.handleLogout` — in the `finally` block, alongside the existing
  redirect, call `AuthEvents.emit(false)`.

Emits are placed explicitly in the controllers (not inside `AuthSession.set()`/`clear()`)
— keeps `AuthSession` a dumb token holder free of event-bus concerns, and matches
Majora's `AuthStorage`/`AuthEvents` split exactly.

### Mount-time status check

A sibling app (Majora) doubles its mount-time "am I logged in" check as a token-refresh
call. **That approach is unsafe here and must not be reused as-is**: kerghan's refresh
tokens are single-use and rotating, with replay-detection that revokes the user's
*entire* refresh-token family when an already-revoked token is presented again
(`auth.service.ts:105-130`, `#revokeTokenFamily`). Calling `/auth/refresh.json` on every
`Header` mount would mean two tabs open at once — both mounting around the same
time — can race: one tab's refresh rotates the token, the other tab's mount-time call
then presents the now-stale token, gets treated as a replay, and the backend logs the
user out of every tab. Not an acceptable trade-off for a routine status check.

Instead: a new **read-only** `POST /auth/status.json` route.

- Frontend: `HeaderController` gains a `checkStatus()` method. If `AuthSession.get()`
  has no stored token, skip the network call entirely and just `AuthEvents.emit(false)`.
  Otherwise `POST /auth/status.json` with `{ refreshToken: AuthSession.get() }`, and emit
  the resulting `loggedIn` value. Called from the new `useAuthEffect` hook on mount,
  alongside subscribing to `AuthEvents` (so the check's own emit is what ultimately
  updates `Header`'s state — one code path for "mount-time confirmation" and "live
  change", same as the live-event case).
- Backend: new `AuthService.status(refreshToken)` needs its **own** read-only lookup —
  it must NOT reuse the existing private `#findActiveRefreshToken` as-is. That method is
  not actually side-effect-free: on finding a *revoked* token it calls
  `#revokeTokenFamily(tokenRow.userId)` (`auth.service.ts:165-167`) before throwing —
  which reintroduces the identical multi-tab hazard this whole redesign exists to avoid
  (Tab A rotates via a real `refresh()`/`login()` call, Tab B's mount-time status check
  then presents the now-revoked token and triggers family-wide revocation anyway, just
  through a different code path). Family revocation on replay is the right behavior for
  *token-consuming* flows (`refresh`, and implicitly `login` establishing a fresh
  family) — it must not fire from a passive status check. So `status()` needs a
  separate, genuinely read-only helper: hash the token, look up the row, and report
  active/invalid based on existence + `revokedAt` + `expiresAt` alone — no
  `refreshTokenRepository.update`, no `#revokeTokenFamily` call, no new token pair
  issued, ever. `refresh()` keeps using `#findActiveRefreshToken` exactly as today.
  Returns `{ loggedIn: boolean }` — validated via the existing `RefreshTokenDto` (same
  shape as `refresh`/`logout`'s body), and the "invalid token" case must resolve to
  `{ loggedIn: false }` rather than propagating a 401.
  Rejected explicitly over verifying the access-token cookie instead (simpler, reuses
  `JwtGuard`'s JWT-verify logic) because the access token's 15-minute TTL
  (`DEFAULT_ACCESS_TOKEN_TTL_MS`) would otherwise make the header flicker to "logged
  out" on any page load past that window, even with a perfectly valid refresh token
  still held — this way status tracks the same thing `AuthSession.isLoggedIn()` already
  conceptually means (a valid stored session), just confirmed server-side.
- **Accepted trade-off**: unlike `/auth/refresh.json` (which immediately rotates/consumes
  a token, tipping off the legitimate owner via a forced logout if someone else replays
  it), a passive `status.json` lets an attacker already holding a stolen-but-unused
  refresh token silently and repeatedly confirm it's still valid, with no side effects
  and no signal to the victim. Token guessing itself stays infeasible (384-bit random
  tokens), so this is a reconnaissance-only concern, not a brute-force one. No
  rate-limiting exists anywhere in this backend today (`login.json`/`refresh.json`
  included), so adding throttling here would be new scope beyond this issue, not parity.
- New route must be `@Public()` (same as the other auth routes) and set the
  `X-Skip-Cache` header, since Tent's proxy caches `*.json` responses by
  method-agnostic, query-string-only key — without it one user's status response could
  be cross-served to another (same reasoning as the existing routes in
  `auth.controller.ts:17-21`).

### Edge cases

- **Logout failing server-side but clearing locally** — already the existing behavior
  (`HeaderController.handleLogout`'s try/catch/finally always clears `AuthSession` and
  redirects regardless of whether the network call succeeded). No new decision needed;
  `AuthEvents.emit(false)` is simply added to that same `finally` block, so it inherits
  the existing guarantee.
- **Stale token found invalid by the status check** — if `/auth/status.json` returns
  `{ loggedIn: false }` for a token still held in `AuthSession`, `checkStatus()` must
  also call `AuthSession.clear()` before emitting — otherwise `ApiClient`'s existing
  401-retry logic (`ApiClient.js:80-96`) keeps attempting to refresh with a token the
  backend already reported as dead.
- **Status check resolving after `Header` unmounts** — `checkStatus()` is async; the
  `useAuthEffect` hook must guard against calling `setLoggedIn` after its own cleanup
  has run (fast route change, test teardown), same pattern as any other async-effect
  cleanup in this codebase.
- **Cross-tab sync — out of scope.** `AuthEvents` rides a `window` `CustomEvent`, which
  only fires within the tab that dispatched it. Logging out in one tab does not update
  another open tab's header immediately; it corrects itself the next time that tab makes
  an authenticated request (401) or remounts. Matches Majora's own scope (same-tab
  only) — no `storage`-event listening added here.

### Scope

- **Register is currently a bug relative to what this issue asks for**:
  `HeaderHelper.render` renders the Register link unconditionally (`HeaderHelper.jsx:24`),
  outside the `isLoggedIn` branch — so it never hides even when logged in today. In
  scope: move Register into the logged-out branch, alongside Login (both hidden once
  `loggedIn` is true).
- **"Future other links"** needs no extra scaffolding — already covered by the core
  mechanism: any future link's owning component just does its own
  `AuthEvents.subscribe` independently, no registry/rule-matcher needed (kerghan has no
  roles, so a plain ternary is enough).
- **Recover** — no password-recovery feature (route, page, or backend endpoint) exists
  anywhere in kerghan yet; the issue text is the only place it's mentioned. Decision: add
  a placeholder `Recover` nav link now (logged-out only, alongside Login/Register),
  pointing at a route that doesn't exist yet — gets the header's visual layout in place
  ahead of the feature. Building the actual recovery flow (backend endpoints + frontend
  pages) is out of scope for this issue and has been spun off separately: #36
  (comment-only cross-reference, not a sub-issue — it's an independent feature build,
  not a piece of this issue's own reactivity work).

## Benefits
- Decouples "did auth change" from "did a redirect happen" — makes future non-redirect
  auth flows (e.g. an in-page login modal) possible without additional plumbing.
- Fixes an existing bug where Register never hides when logged in.
- Any current or future component can react to auth changes independently, with no
  prop-drilling or shared component tree.
- Avoids a multi-tab session-revocation hazard that a naive reuse of the existing
  token-refresh endpoint would have introduced.
