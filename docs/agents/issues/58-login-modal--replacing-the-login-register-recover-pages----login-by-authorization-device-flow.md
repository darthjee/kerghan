## Description

Kerghan's account auth today is a set of separate hash-routed **pages** —
`frontend/assets/js/components/resources/accounts/pages/{Login,Register,Recover,ResetPassword}.jsx`
(+ their `controllers/` and `helpers/`), wired through `components/helpers/AppHelper.jsx` and
`utils/routing/HashRouteResolver.js` (`/login`, `/register`, `/recover`, `/recover-password`). The
backend side is complete: `POST /auth/login.json` returns `{ user, refreshToken }` and sets an
`httpOnly` `access_token` JWT cookie, with a rotating refresh token stored client-side in
`client/AuthSession.js` and the header reacting via the `client/AuthEvents.js` (`auth:changed`)
bus.

A sibling project, **Majora** (design captured in `~/messages/auth-login.md`), instead uses:

1. **A single login modal** opened from the header, with a radio toggle between a classic
   **Password** form and an **Authorize with a logged device** mode. Every mode converges on one
   success handler: persist the session, broadcast the login event.
2. **Login by authorization** — a device-authorization / polling flow (conceptually `gh auth
   login`). A device that does not have the password saved (typically a phone) enters only a
   username; a second device that is already logged in approves or denies the request; the first
   device polls until it is approved and then receives a normal session.

This issue brings both to Kerghan: the modal becomes the **single entry point** for password
login, device authorization, registration, and password recovery, and the four standalone pages
are removed (the emailed reset-link landing `#/recover-password?token=` stays reachable as a thin
redirect into the modal). This is an **umbrella issue**; a later `/arcanum-split-issue` pass
breaks it into the sub-issues listed under "Suggested sub-issue split".

## Problem

- **No password-less path to log in on a second device.** The only way to authenticate is to type
  the password (`POST /auth/login.json`). On a phone where the password is not saved and not
  memorised, there is no way in, even when the user is already logged in on a desktop.
- **Login is a full-page navigation.** `#/login` replaces the whole view
  (`AppHelper` → `Login.jsx`), `client/ApiClient.js` hard-redirects to `#/login`
  (`#sessionExpired`) on an unrecoverable `401`, and `LoginController` hard-redirects to `#/` on
  success. A modal-based flow is lighter and keeps context, but it means reworking those
  redirects.
- **Four parallel page implementations.** `Login`, `Register`, `Recover`, `ResetPassword` each
  carry a `pages/` + `controllers/` + `helpers/` trio plus mirrored specs; the shared "submit →
  `AuthEvents.emit` → redirect" logic is copied across them.
- **No polling primitive.** There is no client-side poll loop anywhere
  (`docs/agents/flow.md:41` — "There is no auto-refresh/polling"), so the requesting side of a
  device-authorization flow is entirely net-new.
- **No device-authorization concept on the backend.** There is no entity, table, endpoint, or
  status machine for "a login someone else vouches for", and no per-request scoped token that is
  not also a login credential.
- **Docs describe a login that no longer matches reality.** `docs/agents/flow.md` step 1 and
  `docs/agents/product.md` still say login is "just giving the backend a GitHub handle; there's no
  password"; `AGENTS.md:36`, `.claude/agents/frontend.md`, `docs/agents/folder-structure.md:8`,
  `README.md` and `docs/agents/architecture/frontend.md` still call the frontend a "tooling-only
  skeleton". Both are stale.

## Expected Behavior

- The header's Login / Register / Recover controls open **one modal** (react-bootstrap `Modal`,
  already available as a dependency) rather than navigating. The modal has selectable modes:
  **Password**, **Authorize with logged device**, **Register**, **Recover password**. A fifth
  mode, **Set new password**, is entered only programmatically when the app opens on
  `#/recover-password?token=…`.
- **Password**, **Authorize with logged device** and **Register** converge on the same success
  handler — mirroring today's `LoginController.handleSubmit`: the refresh token is already
  persisted by the `AccountsClient` call, then `AuthEvents.emit(true, user.isAdmin)`, close the
  modal, go to `#/`.
- **Login by authorization**:
  - The requesting device enters only a username and submits. The backend creates an
    authorization request (`status = open`), records the requesting IP and User-Agent, sets it to
    expire (default 1 hour, `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS`), and returns a **one-time
    scoped poll token** that authorises polling *that one request only* and is not a login
    credential. An unknown or someone-else's username returns the same response shape — it simply
    can never be approved.
  - The requesting device polls every ~5s. `open` → keep waiting (spinner); `approved` → a real
    session (`{ user, refreshToken }` + `access_token` cookie) comes back in that same response
    and the shared success handler runs; `denied` / `expired` / not-found → stop with a message;
    a transient network error → keep retrying, do not give up.
  - On the approving device (already logged in), a "My account → Authorizations" page
    (`#/account/authorization-requests`) lists that user's own `open` requests, showing the
    recorded IP and User-Agent. **Authorize** requires re-entering the approver's own current
    password and sets `status = approved`; **Deny** needs no password and sets `status = denied`.
  - The first poll after approval atomically transitions the request `approved → logged` (a
    single guarded `UPDATE … WHERE status = 'approved'`, `affected === 1` wins) and mints the
    session in that response. Concurrent polls that lose the race get `logged` with no
    credentials. Credentials are minted exactly once.
- `client/ApiClient.js` `#sessionExpired` opens the modal in Password mode instead of navigating
  to `#/login`. `#/login`, `#/register`, `#/recover` bookmarks still resolve (a small redirect
  shim opens the modal).
- The device-authorization session is indistinguishable from a password-login session
  afterwards: same `AuthService#issueTokens` output (JWT cookie + rotating refresh token +
  session row), same `auth:changed` broadcast.
- Every new `*.json` endpoint sets `X-Skip-Cache: true`.
- The stale docs above are corrected, and the new flow is documented.

## Solution

### Scope

Add a `login modal` as the single account-auth entry point and a `login-by-authorization` device
flow, following Kerghan's existing module/component conventions and reusing the
password-reset-token machinery as the template for the scoped poll token and the
`AuthService#issueTokens` path for session minting.

**Backend** (`backend/src/auth/`, NestJS, thin controller, logic in services, `auth_` table
prefix, every route `.json`, `X-Skip-Cache` on every response):

- Extract the private session-minting helpers (`#issueTokens` / `#touchSession` / `#hashToken`)
  out of `auth.service.ts` (currently at the 300-line limit) into a new injectable
  `TokenService`, consumed by both `AuthService` and the new device-flow service. No behaviour
  change.
- New entity `AuthorizationRequest` → table `auth_authorization_requests`, modelled on
  `entities/password-reset-token.entity.ts` (logical FK to `auth_users`, hash-only token
  storage). Fields: `id`, public `uuid` (unique), `username` (as typed), nullable `user_id`
  (`NULL` when the username matched nothing — never listable or approvable), `status` enum
  (`open` / `approved` / `denied` / `logged` / `expired`), `poll_token_hash` (unique, sha256),
  `request_ip`, `request_user_agent`, nullable `approved_by_user_id`, `created_at`, `expires_at`,
  nullable `resolved_at`, nullable `logged_at`. Indexes: unique `uuid`, unique `poll_token_hash`,
  `(user_id, status)`, `(expires_at)`.
- New migration
  `backend/src/database/migrations/<timestamp>-auth-create-authorization-requests.ts` (next in
  sequence after `…120007`), same structure as
  `20260901120005-auth-create-password-reset-tokens.ts`.
- New `AuthorizationRequestService` (internal collaborator, not exported from `AuthModule`, like
  `PasswordResetService`): create (resolve username→user, may be `NULL`; mint
  `randomBytes(48).toString('hex')` poll token, store only its sha256 hash; set `expires_at`;
  emit `authorization-request.created`); poll (look up by `uuid` + `poll_token_hash`, any miss →
  uniform `404`; lazy-expire an overdue `open` row; run the atomic `approved → logged` claim and
  mint the session for the winner); list-open-for-user; authorize (assert ownership + `open` +
  not expired + `bcrypt.compare` the approver's password, every failure → uniform `400`, never
  `401`/`403`); deny (ownership + `open`, no password).
- New `AuthorizationRequestController` (`@Controller('auth')`, thin, `X-Skip-Cache` on every
  response, reuse the `AuthController` cookie + body response shape):
  - `POST /auth/authorization-requests.json` — `@Public()`, body `{ username }`, captures IP +
    User-Agent in the controller, returns `{ uuid, pollToken, expiresAt }` (identical shape for
    an unknown username).
  - `POST /auth/authorization-requests/:uuid/poll.json` — `@Public()`, body `{ pollToken }`,
    returns `{ status }` or, on `approved`, `{ status: 'approved', user, refreshToken }` +
    `Set-Cookie access_token`; `404` on unknown uuid / bad token. POST (not GET) because it
    mutates and to keep the token out of URLs / proxy logs / history.
  - `POST /auth/authorization-requests/mine.json` — authenticated (plain route, global
    `JwtGuard` reads the `access_token` cookie), returns `{ requests: [{ uuid, requestIp,
    requestUserAgent, createdAt, expiresAt }] }`.
  - `POST /auth/authorization-requests/:uuid/authorize.json` — authenticated, body
    `{ password }`, `{ authorized: true }` / uniform `400`.
  - `POST /auth/authorization-requests/:uuid/deny.json` — authenticated, `{ denied: true }` /
    uniform `400`.
- New DTOs in `dto/` (`@IsString @IsNotEmpty`, mirroring `login.dto.ts`); new event classes in
  `events/` (`authorization-request.{created,approved,denied,logged}`, mirroring
  `user-registered.event.ts`) — no listeners required for the MVP.
- Wire the new entity/controller/services into `auth.module.ts`.
- Config: `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` (default `3600000`), read via `ConfigService`.

**Frontend** (`frontend/assets/js/`, thin `.jsx` → `controllers/` → `helpers/` (+ `hooks/`),
mirrored `*Spec.js`, reuse `AuthEvents` + `AuthSession`):

- New `components/common/loginModal/` — `LoginModal.jsx` (react-bootstrap `Modal`, opened/closed
  via a new bus), `controllers/LoginModalController.js` (mode switching, per-mode submit, shared
  success handler, poller lifecycle), `helpers/LoginModalHelper.jsx` (+ a forms helper if it
  exceeds 300 lines), `hooks/useLoginModal.js` (`buildLoginModalEffect` plain function, mirroring
  `buildAuthEffect`). Modes: `password`, `device`, `register`, `recover`, `resetPassword` (last
  one not user-selectable).
- New `client/LoginModalEvents.js` — byte-for-byte mirror of `client/AuthEvents.js`, event
  `login-modal:toggle`, `open(mode)` / `close()` / `subscribe` / `unsubscribe`, so the header,
  `ApiClient`, and the reset-link landing can all open the modal without a React ref.
- New `utils/polling/AuthorizationRequestPoller.js` — plain class, `setTimeout`-scheduled (not
  `setInterval`), per-tick body extracted as an exported plain function for fake-timer specs;
  `open` → keep polling, `approved` → `onApproved` + stop, `denied` / `expired` / `404` →
  `onRejected` + stop, network error → keep retrying.
- New page `components/resources/accounts/pages/AuthorizationRequests.jsx` (+ `controllers/` +
  `helpers/`) for `#/account/authorization-requests`: list open requests with IP + User-Agent,
  per-row **Authorize** (inline password prompt) and **Deny**, reload after each action, generic
  error string on `400`. Auth handling follows the `AdminUsers` precedent (no route guard; a
  `401` opens the modal).
- New thin `ResetPasswordLanding.jsx` for `#/recover-password?token=…`: read the token from the
  query, `LoginModalEvents.open('resetPassword', { token })`, redirect to `#/`.
- `client/AccountsClient.js` — add `createAuthorizationRequest`, `pollAuthorizationRequest` (on
  `approved`, `AuthSession.set(refreshToken)` before resolving), `listAuthorizationRequests`,
  `authorizeAuthorizationRequest`, `denyAuthorizationRequest`.
- `client/ApiClient.js` — `#sessionExpired` opens the modal
  (`LoginModalEvents.open('password')`) instead of `window.location.hash = '/login'`.
- `utils/routing/HashRouteResolver.js` — remove `/login`, `/register`, `/recover`; add
  `/account/authorization-requests`; keep `/recover-password`. Optionally map the removed paths
  to a small `ModalRedirect` component so old bookmarks still work.
- `components/helpers/AppHelper.jsx` — mount `<LoginModal />` once (route-independent), drop the
  removed page entries, add the Authorizations page + the reset landing.
- `components/common/header/` — `HeaderHelper.jsx` links call `onOpenLogin(mode)`;
  `Header.jsx` / `HeaderController.js` add `openLoginModal(mode)`; add an "Authorizations" link
  when logged in.
- Delete `pages/Login.jsx` (+ helper + controller + specs), `pages/Register.jsx` (+ helper +
  specs), `pages/Recover.jsx` (+ helper + specs); slim `ResetPassword.jsx`. Keep
  `RegisterController` / `ResetPasswordController` `validate()` logic, reused by the modal.

**Docs**:

- Fix the stale "GitHub handle, no password" / "tooling-only skeleton" / login-page copy in
  `AGENTS.md`, `.claude/agents/frontend.md`, `docs/agents/folder-structure.md`,
  `docs/agents/flow.md` (step 1), `docs/agents/product.md`, `README.md`,
  `docs/agents/architecture/frontend.md`.
- Document the modal + device flow in `docs/agents/modules/auth.md`, add
  `auth_authorization_requests` to the module DB-strategy list in
  `docs/agents/architecture/backend.md`, and document `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS`.

Explicitly **out of scope**:

- **A persistent server-side "session cookie fallback + `header_status.json` re-hydration"** as
  in Majora's `docs/agents/issues/124-…` note. Kerghan already solves refresh-across-reload with
  the `localStorage` refresh token + `ApiClient`'s `401 → POST /auth/refresh.json → retry` path;
  nothing here changes that.
- **Physical cleanup of stale `logged` / `denied` / `expired` rows.** Expiry is enforced lazily
  on read (no `@nestjs/schedule` in the project). A maintenance script or a scheduled sweep is a
  follow-up.
- **Push / real-time notification of the approving device.** The approver refreshes the
  Authorizations page manually. The `authorization-request.created` event exists so this can be
  added later.
- **QR-code entry / cross-device deep links.** The requesting device types the username; no QR.
- **Rate-limiting / lockout as blocking work.** Recommended limits are noted under "Edge cases &
  risks" and should become their own hardening sub-issue rather than gating the feature.
- **Per-user GitHub token / private-repo access** and any change to the tracked-repo data model —
  untouched here (see `docs/agents/product.md`).
- **Splitting this issue.** This parent documents the whole feature; a later
  `/arcanum-split-issue` pass creates the sub-issues below.

### Suggested sub-issue split

Dependency order, following the #49 → #50–#54 umbrella precedent:

1. **Backend: extract `TokenService` from `AuthService`** (prep). Move `#issueTokens` /
   `#touchSession` / `#hashToken` into `backend/src/auth/token.service.ts`, injected by
   `AuthService`; no behaviour change; brings `auth.service.ts` back under the 300-line limit.
   *Depends on: nothing.*
2. **Backend: authorization-request entity + migration + create/poll endpoints.**
   `auth_authorization_requests` table + entity, `AuthorizationRequestService` (scoped-token
   mint/hash/validate, username→userId incl. `NULL`, lazy expiry, atomic `approved → logged`
   claim), `POST /auth/authorization-requests.json` (`@Public`, IP/UA capture) +
   `POST /auth/authorization-requests/:uuid/poll.json` (`@Public`, returns a standard session on
   `approved`), events `created` / `logged`. Unit + e2e. *Depends on: #1.*
3. **Backend: approver-side endpoints.** Authenticated `…/mine.json`, `…/:uuid/authorize.json`
   (re-check approver password, uniform `400`), `…/:uuid/deny.json`; events `approved` /
   `denied`; wire everything into `AuthModule`. Unit + e2e. *Depends on: #2.*
4. **Frontend: login modal shell + Password & Register modes.** `common/loginModal/`,
   `LoginModalEvents` bus, mount in `AppHelper`, header opens the modal, mode selector,
   `password` + `register` modes reuse existing `AccountsClient` calls + shared success handler;
   repoint `ApiClient.#sessionExpired`; delete the Login + Register pages; route cleanup. Jasmine
   specs. *Depends on: nothing (integrates against existing `/auth/login|register`).*
5. **Frontend: Recovery modes.** `recover` + `resetPassword` modes; `#/recover-password?token=`
   becomes a thin landing that opens the modal; delete the Recover page, slim `ResetPassword`.
   Jasmine specs. *Depends on: #4.*
6. **Frontend: device-authorization mode + poller.**
   `utils/polling/AuthorizationRequestPoller.js`, the new `AccountsClient` create/poll methods,
   the modal's `device` mode (username-only → create → poll → shared success handler), spinner /
   denied / expired / not-found UI. Jasmine specs with fake timers. *Depends on: #2, #4.*
7. **Frontend: "My account → Authorizations" page.**
   `resources/accounts/pages/AuthorizationRequests.jsx` (+ controller + helper), route + `PAGES`
   entry, header link, the `list` / `authorize` / `deny` `AccountsClient` methods, inline
   authorize-password prompt. Jasmine specs. *Depends on: #3.*
8. **Docs sync.** Fix the stale login copy across `AGENTS.md`, `.claude/agents/frontend.md`,
   `docs/agents/{folder-structure,flow,product}.md`, `README.md`,
   `docs/agents/architecture/frontend.md`; document the flow in `docs/agents/modules/auth.md`,
   the table in `architecture/backend.md`, and the new env var. *Depends on: #2–#7.*

(#1 may be folded into #2 if reviewers prefer 7 issues; #4 + #5 may merge.)

### Acceptance criteria

- [ ] Header Login / Register / Recover controls open a single react-bootstrap modal instead of
      navigating; `#/login`, `#/register`, `#/recover` no longer render standalone pages (a
      redirect shim keeps old bookmarks working).
- [ ] The modal offers Password, Authorize-with-logged-device, Register and Recover modes;
      `#/recover-password?token=…` opens the modal in a Set-new-password mode.
- [ ] Password, device-authorization and Register success all run one shared handler:
      `AuthSession` holds the refresh token, `AuthEvents.emit(true, isAdmin)` fires, the modal
      closes, the app navigates to `#/`.
- [ ] `POST /auth/authorization-requests.json` creates an `open` request, stores the requesting
      IP + User-Agent, sets `expires_at` from `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` (default
      1h), and returns `{ uuid, pollToken, expiresAt }` — identical shape and timing for an
      unknown or someone-else's username; only the SHA-256 hash of `pollToken` is persisted.
- [ ] `POST /auth/authorization-requests/:uuid/poll.json` returns `{ status: 'open' }` while
      waiting, `{ status: 'approved', user, refreshToken }` + `Set-Cookie access_token` exactly
      once, `{ status: 'logged' }` (no credentials) to any later/losing poll,
      `{ status: 'denied' | 'expired' }` as appropriate, and `404` for an unknown uuid or wrong
      poll token (indistinguishable).
- [ ] The `approved → logged` transition is a single guarded `UPDATE … WHERE status =
      'approved'`; an e2e test fires two simultaneous post-approval polls and asserts exactly one
      credential body.
- [ ] `POST /auth/authorization-requests/mine.json` (authenticated) lists only the caller's own
      `open`, non-expired requests with their recorded IP + User-Agent; `user_id IS NULL` rows
      are never returned.
- [ ] `POST /auth/authorization-requests/:uuid/authorize.json` (authenticated) requires the
      approver's correct current password and flips the row to `approved`; wrong password,
      not-owner and already-resolved all return the same `400` (never `401`/`403`).
- [ ] `POST /auth/authorization-requests/:uuid/deny.json` (authenticated) flips the row to
      `denied` with no password.
- [ ] A device-authorization "logged" session is byte-for-byte equivalent to a password-login
      session (same `TokenService.issueTokens` output: JWT cookie + rotating refresh token +
      session row).
- [ ] Every new `*.json` route sets `X-Skip-Cache: true`; an e2e test asserts it on every
      response.
- [ ] The requesting-side poller keeps polling on `open` and on transient network errors, and
      stops on `approved` / `denied` / `expired` / not-found; it is `setTimeout`-based and its
      tick body is unit-tested with fake timers.
- [ ] `client/ApiClient.js` opens the modal (Password mode) on an unrecoverable `401` instead of
      redirecting to `#/login`, and opening the modal issues no API call (no loop).
- [ ] `backend/src/auth/auth.service.ts` stays under 300 lines (`TokenService` extracted).
- [ ] New backend code has `*.service.spec.ts` unit tests and `*.controller.e2e-spec.ts` tests
      (supertest + `cookieParser()`), matching `auth.controller.e2e-spec.ts`; new frontend code
      has mirrored Jasmine specs; `docker-compose run --rm kerghan_tests yarn test` and
      `docker-compose run --rm kerghan_fe yarn lint` pass.
- [ ] `docs/agents/flow.md`, `docs/agents/product.md`, `AGENTS.md`, `.claude/agents/frontend.md`,
      `docs/agents/folder-structure.md`, `README.md` and `docs/agents/architecture/frontend.md`
      no longer describe login as "just a GitHub handle" or the frontend as a "tooling-only
      skeleton"; `docs/agents/modules/auth.md` documents the modal + device flow;
      `docs/agents/architecture/backend.md` lists `auth_authorization_requests`; the new env var
      is documented.

## Benefits

- Gives users a password-less way to log in on a second device (the driving mobile use case),
  approved from a device they already trust, without introducing any new stored credential.
- Replaces four parallel auth pages and their duplicated submit/redirect logic with one modal and
  one shared success handler, and removes a full-page navigation from the login path.
- Reuses Kerghan's existing primitives — the password-reset-token pattern for the scoped poll
  token, `AuthService#issueTokens` for session minting, the `AuthEvents` bus, the
  `buildAuthEffect` "extract a testable plain function" pattern — so the new surface stays
  consistent with the module and component conventions already in the codebase.
- Establishes a documented, atomic status machine (`open → approved → logged`, plus `denied` /
  `expired`) with enumeration-safe responses and a guarded single-mint transition, so the later
  sub-issues are built against a settled contract.
- Brings the auth documentation back in line with what actually ships.

## Edge cases & risks (for the split sub-issues to address)

- **Abuse of a victim's Authorizations page.** Anyone can create an `open` request for any
  username; matched-username rows appear on that user's page with the requester's IP/UA.
  Mitigations to specify in the hardening sub-issue: rate-limit create per client IP and per
  target username; cap concurrent `open` rows per user (evict oldest); unmissable UI copy that
  "Authorize logs someone else in — only if it's you"; one-click Deny. `user_id IS NULL` rows
  surface nowhere.
- **Enumeration safety.** Create returns an identical `{ uuid, pollToken, expiresAt }` shape and
  timing regardless of whether the username exists; wrong poll token vs wrong uuid → identical
  `404`; wrong approver password vs not-owner vs already-resolved → identical `400`. Never `401`
  from the approve/deny routes for a business rejection, or `ApiClient` will refresh-and-retry
  and mask it.
- **Concurrent poll race.** `UPDATE … WHERE status = 'approved'` with `affected === 1` guarantees
  a single credential mint; the same guard covers a poll racing the `authorize` call.
- **Poll-token leakage.** Sent in a POST body over HTTPS only — never in a URL, proxy log, or
  browser history; single row, single capability, never accepted by `JwtGuard`, dies when the row
  leaves `open` / `approved`. Do not log request bodies for these routes.
- **Tent caching.** Every new `*.json` route must set `X-Skip-Cache: true`; the uuid in the path
  does not make it safe — Tent keys by path+query regardless of method.
- **Clock / expiry.** Lazy, DB-clock only; the client `expiresAt` is display-only; device skew is
  irrelevant.
- **Stale-row growth.** No automatic purge in scope; unique `poll_token_hash` means no collision
  risk; follow-up maintenance script or scheduler.
- **`auth.service.ts` at the line limit.** Any addition overflows `max-lines` — hence the
  `TokenService` extraction as sub-issue #1.

## Split

Agreed in the `/arcanum-split-issue` discussion: use the drafted 8-part split verbatim, add a
dedicated hardening sub-issue (the rate-limiting / abuse concerns from "Edge cases & risks" become
tracked work now rather than a vague future follow-up), and keep documentation as a single
trailing sub-issue that depends on everything else. Nine sub-issues total.

Rationale: each piece is independently reviewable with an explicit dependency edge; the two
backend and two frontend entry points (`#1`/`#2` and `#4`) can start in parallel; the docs issue
lands last so it captures the final endpoint/env-var shape including the hardening knobs.

Ownership: `#1`–`#3`, `#8` → `backend` agent; `#4`–`#7` → `frontend` agent; `#9` → `architect`
agent (cross-cutting docs across `docs/agents/`, `AGENTS.md`, `.claude/agents/`, `README.md`).

| # | Sub-issue | Agent | Depends on |
|---|---|---|---|
| 1 | Backend: extract `TokenService` from `AuthService` (prep — move `#issueTokens` / `#touchSession` / `#hashToken`, no behaviour change, brings `auth.service.ts` back under 300 lines) | backend | — |
| 2 | Backend: `auth_authorization_requests` entity + migration + `AuthorizationRequestService` + `POST /auth/authorization-requests.json` (`@Public`, IP/UA capture) + `POST /auth/authorization-requests/:uuid/poll.json` (`@Public`, atomic `approved → logged` claim, standard session on `approved`); events `created` / `logged`; unit + e2e | backend | 1 |
| 3 | Backend: approver-side endpoints — authenticated `…/mine.json`, `…/:uuid/authorize.json` (re-check approver password, uniform `400`), `…/:uuid/deny.json`; events `approved` / `denied`; wire into `AuthModule`; unit + e2e | backend | 2 |
| 4 | Frontend: login modal shell + Password & Register modes — `common/loginModal/`, `LoginModalEvents` bus, mount in `AppHelper`, header opens the modal, mode selector, shared success handler; repoint `ApiClient.#sessionExpired`; delete the Login + Register pages; route cleanup; Jasmine specs | frontend | — |
| 5 | Frontend: Recovery modes — `recover` + `resetPassword` modes; `#/recover-password?token=` becomes a thin landing opening the modal; delete the Recover page, slim `ResetPassword`; Jasmine specs | frontend | 4 |
| 6 | Frontend: device-authorization mode + `utils/polling/AuthorizationRequestPoller.js` — `AccountsClient.createAuthorizationRequest` / `pollAuthorizationRequest`, the modal's `device` mode (username-only → create → poll → shared success handler), spinner / denied / expired / not-found UI; Jasmine specs with fake timers | frontend | 2, 4 |
| 7 | Frontend: "My account → Authorizations" page — `resources/accounts/pages/AuthorizationRequests.jsx` (+ controller + helper), route + `PAGES` entry, header link, `list` / `authorize` / `deny` `AccountsClient` methods, inline authorize-password prompt; Jasmine specs | frontend | 3 |
| 8 | Backend: rate-limiting / abuse hardening — cap concurrent `open` requests per user (evict oldest), throttle `POST /auth/authorization-requests.json` per client IP and per target username, brute-force protection on `…/authorize.json`; config knobs read via `ConfigService`; unit + e2e | backend | 2, 3 |
| 9 | Docs sync — fix the stale "GitHub handle, no password" / "tooling-only skeleton" copy across `AGENTS.md`, `.claude/agents/frontend.md`, `docs/agents/{folder-structure,flow,product}.md`, `README.md`, `docs/agents/architecture/frontend.md`; document the modal + device flow in `docs/agents/modules/auth.md`, `auth_authorization_requests` in `docs/agents/architecture/backend.md`, and `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` + the new hardening env vars | architect | 2–8 |
