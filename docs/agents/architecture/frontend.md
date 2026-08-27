# Architecture — Frontend

React 19 + Vite, built and tested the same way regardless of backend language. Hash-based
routing, a `client/` HTTP layer, and a Register/Login auth flow already exist (see "Auth flow"
below) — the dashboard/analytics views themselves (issue volume, age, label breakdowns, "needs
attention" lists) are still to come.

## Stack

- React 19 (no React Bootstrap/UI kit chosen yet — Majora's is deliberately not carried over)
- Vite (dev server on port 8080, `npm run build` outputs to `dist/`, matching the
  `docker_volumes/static` bind mount)
- Jasmine + c8 (tests/coverage), driven through a custom Node ESM loader
  (`specs/support/jsx-loader.mjs`) that transforms `.jsx` via Babel, stubs image/CSS imports,
  and shims `import.meta.env` for Node-based specs
- ESLint (flat config, `eslint.config.mjs`) — 2-space indent, single quotes, semicolons
  required, max complexity 10, max 300 lines/file, JSDoc required on public API

## Directory layout (current)

```
frontend/assets/js/
  App.jsx            # placeholder shell component
  main.jsx           # entry point — mounts App into #root

frontend/specs/
  assets/js/AppSpec.js
  support/jsx-loader.mjs
```

Once real views exist, mirror Majora's shape (`components/`, `client/`, `utils/`) rather than
inventing a new one — see `frontend.md` in `.claude/agents/` for the full component-extraction
conventions to apply as it grows. Given `docs/agents/product.md`'s "aggregation-friendly, not
just CRUD" API design, expect the eventual `client/` layer to fetch pre-aggregated dashboard data
(counts, groupings, "needs attention" lists) rather than raw per-issue CRUD — plus, per
`docs/agents/flow.md`, some of that fetching happens directly against GitHub's API rather than
the backend at all.

## Auth flow

`client/AccountsClient.js` wraps every `auth` route the backend exposes — see
`docs/agents/modules/auth.md` for the request/response contract, not duplicated here:

- `register(fields)` — `POST /auth/register.json`
- `login({ username, password })` — `POST /auth/login.json`
- `refresh(refreshToken)` — `POST /auth/refresh.json`
- `logout(refreshToken)` — `DELETE /auth/logoff.json`

`register`/`login`/`refresh` all persist the response's `refreshToken` via `client/AuthSession.js`
before resolving; `logout` clears it unconditionally, even when the request itself fails, so the
client-side session always ends. `AuthSession` is a thin `localStorage` wrapper (`get`/`set`/
`clear`/`isLoggedIn`) around a single key — the access token itself is never touched by the
frontend at all, since the backend sets it as an `httpOnly` cookie (see
`docs/agents/modules/auth.md`'s JWT/refresh-token flow).

`client/ApiClient.js` reacts to a `401` transparently rather than surfacing it to callers: it
reads the stored refresh token, calls `POST /auth/refresh.json` directly (a plain internal
request, not through `AccountsClient`, to avoid a circular import), persists the renewed
`refreshToken`, and retries the original request exactly once. If there is no stored refresh
token, or the refresh call itself fails (invalid/expired/already-revoked refresh token) or the
retried request comes back `401` again, `ApiClient` treats the session as expired: it clears
`AuthSession` and redirects to the Login route (`#/login`) instead of resolving/rejecting the
original call normally.

`components/common/header/Header.jsx` reads `AuthSession.isLoggedIn()` directly at render time
(no context/global-state provider, consistent with this codebase's static-helper style) to show
a Login nav link when logged out, or a Logout action — backed by
`components/common/header/controllers/HeaderController.js` — when logged in. Logging out calls
`AccountsClient.logout` and redirects home regardless of whether the request succeeded, since
`AccountsClient.logout` already clears `AuthSession` unconditionally.

## No Vite proxy to the backend

There is no Vite `server.proxy` config pointing at the backend — that's the Tent proxy's job
(see `architecture/proxy.md`), not Vite's. In dev, Tent forwards non-asset requests to the Vite
dev server for HMR; Vite itself never talks to the backend directly.

See `.claude/agents/frontend.md` for local dev commands, code conventions, and the JSX
extraction rules.
