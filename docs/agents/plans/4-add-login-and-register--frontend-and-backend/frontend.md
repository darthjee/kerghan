# Frontend Plan: Add login and register, frontend and backend

Main plan: [plan.md](plan.md)

Scope: `frontend/` only, per `.claude/agents/frontend.md`.

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts". This file's `AccountsClient`
must call `POST /accounts/register.json` with body
`{ username, email, password, password_confirmation }` (note the
`passwordConfirmation` → `password_confirmation` key rename on the wire)
and expect `200` + `{ id, username, email }` on success, or `400` +
`{ error }` on failure.

## Implementation Steps

### Step 1 — Routing utilities

New files under `frontend/assets/js/utils/routing/` (per `routes.md`'s
three-layer split, generic/no app knowledge in the first two):
- `Route.js` — path pattern matcher + named param extraction (e.g. turns
  `/games/:id` into a regex with a capture group; not actually needed by
  this issue's two static routes, but the layer is still created since the
  next issue to add a route relies on it existing).
- `Router.js` — ordered registry of `Route` instances, resolves a path to
  a page key (first match wins).
- `HashRouteResolver.js` — owns the route table and reads/writes
  `location.hash`:
  ```js
  const ROUTES = [
    ['/register', 'register'],
    ['/', 'home'],
  ];
  ```

### Step 2 — Bootstrap setup

- Add `bootstrap`, `react-bootstrap`, `bootstrap-icons` to
  `frontend/package.json` dependencies.
- In `frontend/assets/js/main.jsx`, add (once, globally, before the app
  renders): `import 'bootstrap/dist/css/bootstrap.min.css';`,
  `import 'bootstrap/dist/js/bootstrap.bundle.min.js';`,
  `import 'bootstrap-icons/font/bootstrap-icons.css';`.

### Step 3 — App shell wiring

- `frontend/assets/js/components/AppController.js` +
  `frontend/assets/js/components/helpers/AppHelper.jsx` — resolve the
  current page key via `HashRouteResolver` and map it to a component:
  ```js
  const PAGES = { register: <Register />, home: <Home /> };
  ```
- Replace the current placeholder `frontend/assets/js/App.jsx` content
  with the real app shell: renders `Header` wrapping the page resolved by
  `AppController`/`AppHelper` (`Header`'s `children` prop, per
  `components.md`'s worked example).

### Step 4 — `Header` component

`frontend/assets/js/components/common/header/`:
- `Header.jsx` — no `controllers/` yet (no state/auth-awareness needed for
  this issue — see issue's "Explicitly out of scope"); renders a
  `react-bootstrap` `Navbar` with the brand linking to `#/` and, inside
  `Navbar.Collapse`, a `Nav.Link href="#/register"` — always shown,
  regardless of auth state.
- `helpers/HeaderHelper.jsx` — the actual `Navbar`/`Nav`/`Nav.Link` markup,
  per the component/helper split even though there's no controller yet.

### Step 5 — API client

`frontend/assets/js/client/`:
- `ApiClient.js` — generic `postJson(path, body)`: `fetch` with
  `credentials: 'same-origin'` and JSON headers/body, parses the JSON
  response either way, throws `ApiError` (carrying `status` and the
  backend's `{ error }` message) when `!response.ok`.
- `ApiError.js` — small error class (`status`, `message`).
- `AccountsClient.js` — `register({ username, email, password,
  passwordConfirmation })` → `ApiClient.postJson('/accounts/register.json',
  { username, email, password, password_confirmation: passwordConfirmation })`.

### Step 6 — `Home` page

`frontend/assets/js/components/resources/home/pages/Home.jsx` — blank,
renders nothing beyond what `Header`'s `children` slot already gives it (no
`controllers/`/`helpers/` needed — no logic, no non-trivial markup).

### Step 7 — `Register` page

`frontend/assets/js/components/resources/accounts/pages/`:
- `Register.jsx` — state (`username`, `email`, `password`,
  `passwordConfirmation`, field errors, submit-error) + wiring only,
  delegates submit logic to `RegisterController` and all rendering to
  `RegisterHelper`, per the component/controller/helper split.
- `controllers/RegisterController.js` — pre-submit validation (all fields
  non-empty, basic email shape, `password === passwordConfirmation`) that
  sets inline field errors and skips the API call when it fails; on a
  clean form, calls `AccountsClient.register(...)`, catches `ApiError` and
  sets a submit-error message for `RegisterHelper` to render; on success,
  redirects to `/#/` (`window.location.hash = '/'`) — no token to store
  client-side, the session cookie is already set via `Set-Cookie`.
- `helpers/RegisterHelper.jsx` — the form markup (four fields, inline
  field-error text, a Bootstrap alert for the submit-error, a submit
  button), plain Bootstrap classes (no interactive JS behavior needed
  beyond the submit handler already being wired by the controller).

## Files to Change

- `frontend/assets/js/utils/routing/Route.js` — new
- `frontend/assets/js/utils/routing/Router.js` — new
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — new
- `frontend/package.json` — add `bootstrap`, `react-bootstrap`,
  `bootstrap-icons`
- `frontend/assets/js/main.jsx` — add global Bootstrap imports
- `frontend/assets/js/App.jsx` — replace placeholder with real app shell
- `frontend/assets/js/components/AppController.js` — new
- `frontend/assets/js/components/helpers/AppHelper.jsx` — new
- `frontend/assets/js/components/common/header/Header.jsx` — new
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — new
- `frontend/assets/js/client/ApiClient.js` — new
- `frontend/assets/js/client/ApiError.js` — new
- `frontend/assets/js/client/AccountsClient.js` — new
- `frontend/assets/js/components/resources/home/pages/Home.jsx` — new
- `frontend/assets/js/components/resources/accounts/pages/Register.jsx` — new
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` — new
- `frontend/assets/js/components/resources/accounts/pages/helpers/RegisterHelper.jsx` — new
- `frontend/specs/...` — one spec per new file above, mirroring
  `assets/js/` 1:1 (see "CI Checks"/`frontend.md` for the testing pattern)

## CI Checks

- `frontend`: `npm run coverage` (CI job: `jasmine`) and `npm run lint`
  (CI job: `frontend-checks`) — run via `docker-compose run --rm
  kerghan_fe <command>` locally, never directly on the host.

## Notes

- `routes.md`'s `accessRouteConfig` layer is explicitly **not** built —
  neither `/` nor `/register` is gated (see issue's "Explicitly out of
  scope").
- Existing `frontend/specs/assets/js/AppSpec.js` currently tests the
  placeholder `App.jsx`; it needs updating once `App.jsx` is replaced in
  Step 3, to match the new shell instead of asserting on the placeholder
  markup.
- After `Router`/`Header`/`Register`/`Home` land, the development loop from
  `frontend.md` applies: implement → `yarn test` + `yarn lint_fix` →
  re-check new JSX against the extraction rules — don't stop after lint
  passes without that third pass.
