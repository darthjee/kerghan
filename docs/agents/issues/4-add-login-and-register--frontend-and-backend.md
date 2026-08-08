# Issue: Add login and register, frontend and backend

## Description

Add account registration to kerghan: a new backend endpoint that creates a
`User`, and the app's first two frontend pages (`Register` and a blank
`Home`) reachable through a shared Bootstrap header. This is also the
project's first frontend route, so it establishes the hash-routing and
Bootstrap/component-organization patterns (per `routes.md` / `components.md`)
that later pages will follow.

## Problem

Backend currently only supports logging in an existing `User` (`POST
/login.json`) — there is no way to create one. The frontend has no routing,
no pages, and no shared header at all; it's still the Vite placeholder
(`frontend/assets/js/App.jsx`). There is no self-serve way for a new user to
get an account, and no app shell for future pages to hang off of.

## Expected Behavior

- Visiting `/#/` shows a blank page with just the Bootstrap header (brand
  linking to `/#/`, a "Register" link at the top right).
- Clicking "Register" navigates to `/#/register`, showing a form with
  username, email, password, and password confirmation.
- Submitting a valid form calls the backend, which creates the `User`, sets
  the session cookie (same as login), and the frontend redirects to `/#/`.
- Submitting an invalid form (empty fields, mismatched passwords, malformed
  email, or a duplicate username/email reported by the backend) shows an
  inline error and does not navigate away.

## Solution

### Backend endpoints

- New route: `POST /accounts/register.json`, following the same
  request-handling pattern as `LoginHandler` (a `RequestHandler` subclass
  registered in `Router`/`RouteRegister`). On success it creates the `User`,
  regenerates the session, sets `req.session.userId`, and responds `200`
  with `UserSerializer` — the same session/response contract as login.
- Existing login route renamed for namespace consistency:
  `POST /login.json` → `POST /accounts/login.json`. There are no known
  callers of the old path yet (checked `proxy/` — no references), so this is
  a straight rename, not an added alias.

### Frontend routing

Follows the hash-routing pattern documented in `routes.md` (worked example:
[majora](https://github.com/darthjee/majora)), scaled down to this app's
current needs — no access-check config required since neither page is
gated:

- **`Route`** — path pattern matcher + param extraction (generic, no
  app-specific knowledge).
- **`Router`** — ordered registry of `Route`s, resolves a path to a page key.
- **`HashRouteResolver`** — owns the route table and reads/writes
  `location.hash`.
- **`AppController`/`AppHelper`** — maps the resolved page key to a React
  component.

Route table for this issue:

```js
const ROUTES = [
  ['/register', 'register'],
  ['/', 'home'],
];
```

Page key → component:

```js
const PAGES = {
  register: <Register />,
  home: <Home />,
};
```

### Bootstrap & Header component

Follows the stack/organization conventions in `components.md` (worked
example: [majora](https://github.com/darthjee/majora)):

- **Stack**: React Bootstrap 5 (`react-bootstrap`) for interactive widgets
  (`Navbar`, `Nav`), plain Bootstrap 5 CSS classes for static layout,
  Bootstrap Icons for iconography. New deps to add: `bootstrap`,
  `react-bootstrap`, `bootstrap-icons`.
- **Import once, globally**, in `frontend/assets/js/main.jsx`:
  `bootstrap/dist/css/bootstrap.min.css`,
  `bootstrap/dist/js/bootstrap.bundle.min.js`,
  `bootstrap-icons/font/bootstrap-icons.css` — never per-component.
- **Header** lives at `components/common/header/` (shared by the app shell,
  not resource-specific): `Header.jsx` + `helpers/HeaderHelper.jsx`. No
  `controllers/` yet — the header currently has no state/logic of its own
  (no auth-awareness), so a controller would be pure ceremony; add one when
  login-aware toggling lands.
  - `Header.jsx`: renders a `Navbar` with the app brand linking to `#/` and,
    inside `Navbar.Collapse`, a `Nav.Link href="#/register"` for
    registration.
  - The register link is **always shown** for now, regardless of auth state
    — toggling it based on login state is explicitly deferred to a future
    issue.
- **Register page** lives under
  `components/resources/accounts/pages/Register.jsx`, following the
  page/controller/helper split from `components.md` (`RegisterController.js`
  for the submit logic, `RegisterHelper.jsx` for the form markup).
- **Home page** (`components/resources/home/pages/Home.jsx` or similar) is a
  blank page rendering just inside the shared `Header`/`children` shell —
  no controller/helper needed given it has no logic or non-trivial markup.

### Register form fields & validation

Fields: `username` (text), `email` (email), `password` (password),
`password_confirmation` (password, client-side pairing check).

- **Password confirmation is checked on both sides**:
  - Frontend: `RegisterController` rejects submit (no API call) when
    `password !== passwordConfirmation`.
  - Backend: `RegisterHandler` also receives `password` and
    `password_confirmation` in the body and throws `BadRequestError` if they
    don't match — defense in depth against a direct API call that bypasses
    the frontend check. Only `password` (not the confirmation) is ever
    hashed/persisted.
- **Client-side validation is richer than HTML5 attributes alone**:
  `RegisterController` pre-checks all fields non-empty, a basic email shape,
  and password/confirmation match — surfacing inline errors — before ever
  calling the API. The backend remains the source of truth for
  uniqueness/format errors (duplicate username/email, malformed email per
  `isEmail`), which the frontend just relays as returned.
- **No password strength/complexity rule for now** (no minimum length or
  character-class checks), on either side — only presence and confirmation
  match are enforced. Introducing a strength policy is left to a future
  issue.

### API client / fetch pattern

Frontend and backend are always same-origin: the reverse proxy
(`proxy/dev_configuration/rules/backend.php` / `frontend.php`) routes any
`*.json` request to the Node backend and everything else to the
frontend/static files, in every environment. So no CORS setup and no base
URL config are needed — only relative paths, and `fetch`'s default
`credentials: 'same-origin'` already sends the session cookie.

- **`frontend/assets/js/client/ApiClient.js`** — generic wrapper (per the
  `client/` folder convention in `components.md`), e.g. `postJson(path,
  body)`: performs the `fetch` (`credentials: 'same-origin'`, JSON
  headers/body), parses the JSON response either way, and throws a small
  `ApiError` (carrying `status` + the backend's `{ error }` message) when
  the response isn't `ok`. Reusable later by login/logout.
- **`frontend/assets/js/client/AccountsClient.js`** — thin resource-specific
  wrapper: `register({ username, email, password, passwordConfirmation })`
  → `ApiClient.postJson('/accounts/register.json', ...)`.
- **`RegisterController`** calls `AccountsClient.register(...)`, catches
  `ApiError` and sets an error-message state for `RegisterHelper` to render
  (e.g. a Bootstrap alert above the form); on success it redirects to `/#/`
  — the session cookie is already set via `Set-Cookie` by the backend, so
  there's no token to store client-side (unlike majora's `AuthStorage`).

### Scope boundaries

**In scope**
- Backend: `POST /accounts/register.json` (new), `POST /login.json` →
  `/accounts/login.json` (renamed)
- Frontend routing infra (`Route`/`Router`/`HashRouteResolver`/
  `AppController`/`AppHelper`) with two routes: `/` (home) and `/register`
- Bootstrap/react-bootstrap/bootstrap-icons setup (new deps, global import
  in `main.jsx`)
- `Header` component: brand → `/#/`, register link always visible
- `Register` page: form (username, email, password, confirmation), client +
  server validation, `ApiClient`/`AccountsClient`
- `Home` page: blank, renders inside `Header`
- Redirect to `/#/` on successful registration (cookie already set by the
  response)
- Automated tests (see "Testing strategy" below)

**Explicitly out of scope** (adjacent, but not part of this issue)
- A frontend **login page/form** — only the backend login route is renamed
- **Login-state awareness** in the header (toggling the register link,
  showing logoff) — deferred
- **Password strength/complexity rules** — deferred
- Logout endpoint/UI
- Password reset / forgot-password flow
- Email verification/confirmation
- Access-control config (`accessRouteConfig`-equivalent) — not needed, no
  page is gated yet
- An auth-status endpoint/check (majora's `client.status()`) — not needed,
  the header doesn't branch on auth state yet
- i18n/translation layer — kerghan's frontend has none yet (unlike majora's
  `Translator.t()`); strings are hardcoded English literals for now

### Testing strategy

Follows existing spec coverage conventions (`backend/spec/server/handlers/LoginHandler_spec.js`
as the pattern to mirror) — this issue includes tests, not just implementation:

- **Backend**: a `RegisterHandler_spec.js` alongside the existing handler
  specs — covers success (user created, session regenerated, `userId` set,
  `200` + serialized user), missing/mismatched password confirmation
  (`BadRequestError`), and duplicate username/email (field-specific "not
  available" error).
- **Frontend**: specs for the new routing utils (`Route`, `Router`,
  `HashRouteResolver`), `Header`, `Register` (+ `RegisterController`/
  `RegisterHelper`), and `Home`, using the project's existing Jasmine setup
  (`frontend/specs`).

### Edge cases

- **Already-logged-in user hits register**: allowed — `POST
  /accounts/register.json` behaves the same whether or not a session
  already exists; it regenerates the session and overwrites `userId` with
  the newly-created user, same as calling login again. No auth-gate check is
  added on the `/register` frontend route for this — no page is auth-gated
  yet in this app (see "Scope boundaries").

### Performance & security considerations

- **Session fixation**: `RegisterHandler` calls the same
  `#regenerateSession()` pattern as `LoginHandler` before setting
  `req.session.userId`, so a freshly-registered session id is never reused.
- **Password hashing**: `bcrypt.hash(password, 10)` — same salt-round
  constant already used in `backend/seeders/20260808060903-demo-user.js` —
  via the async form (not `hashSync`), consistent with `Authenticator`'s
  async `bcrypt.compare`, so hashing doesn't block the event loop
  synchronously.
- **Uniqueness/collation**: the `users` table migration sets no explicit
  collation, so it inherits MySQL's default (case-insensitive for the
  standard utf8mb4 collations). Rely on that DB-level guarantee rather than
  adding app-level `.toLowerCase()` normalization for username/email.
- **Duplicate username/email error messages**: the response tells the user
  specifically which field is unavailable (e.g. "username is not
  available" / "email is not available") — prioritizing form UX over
  hiding account existence. This intentionally accepts an email/username
  enumeration risk for now; `Authenticator` already avoids this on the
  *login* side (`DUMMY_DIGEST` timing guard), but register's uniqueness
  check makes full avoidance impractical without hurting the form. The
  agreed mitigation is rate limiting (see below), not obscuring the
  message.
- **Rate limiting**: there is no rate-limiting middleware anywhere in the
  backend today (`Router.js`/`RouteRegister.js`), and login has none
  either. Deliberately left out of scope for this issue — introducing the
  project's first rate limiter is tracked as separate future work, meant to
  also cover the enumeration risk above.

## Benefits

- Users can create their own account instead of relying on seeded/manual
  data — unblocks any further auth-gated feature work.
- Establishes the frontend's first routing and Bootstrap component
  patterns (hash routing, Header/page/controller/helper split), which
  future pages reuse instead of each reinventing app shell wiring.
- Login and register share one namespace (`/accounts/*.json`) and one
  session contract, keeping the two endpoints consistent as more account
  actions (logout, password reset) are added later.
