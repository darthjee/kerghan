# Issue: Docs: sync auth documentation for the login modal and device flow

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issues 2–8 (do this last, so it captures the final endpoint shape, entity, and
config keys — including the hardening knobs from sub-issue 8). All of #58's sub-issues 2–8 are
already merged (#79, #80, #83, #84, #85), so the code this issue documents is the real, shipped
state, not a moving target.

Kerghan's documentation still describes an auth model that no longer exists: several files call
the frontend a "tooling-only skeleton", and `docs/agents/flow.md` / `docs/agents/product.md` /
`AGENTS.md` say login is "just giving the backend a GitHub handle; there's no password". The
shipped reality is username/password + JWT cookie + rotating refresh token, and after #58 it is
also a login modal plus a device-authorization flow. This sub-issue brings the docs back in line.

## Problem

- Stale "tooling-only skeleton" copy: `AGENTS.md:36`, `.claude/agents/frontend.md`,
  `docs/agents/folder-structure.md:8`, `README.md`, and `docs/agents/architecture/frontend.md`
  (whose "Directory layout (current)" section still shows only `App.jsx`/`main.jsx`, contradicting
  its own "Auth flow" section a few lines below, which already documents real files like
  `client/AccountsClient.js` and `components/common/header/Header.jsx`).
- Stale "login is just a GitHub handle" copy: `docs/agents/flow.md` step 1,
  `docs/agents/product.md`, and `AGENTS.md`'s own opening paragraph (not previously called out,
  found while investigating this issue).
- README.md's "Status" paragraph also mislabels the backend itself as an "Express/Sequelize
  skeleton" in the same breath as the frontend-skeleton claim — it's actually NestJS/TypeORM
  (already correct in `docs/agents/folder-structure.md`). Fixing only the frontend half next to
  it would leave the paragraph internally inconsistent.
- No documentation of the login modal, the `auth_authorization_requests` entity, the
  device-authorization endpoints/flow, or the new environment variables.

## Expected Behavior

- No doc describes the frontend as a skeleton or login as "just a GitHub handle" (including the
  two extra spots found above: `AGENTS.md`'s opening paragraph and README.md's backend
  Express/Sequelize claim).
- `docs/agents/flow.md` step 1 and `docs/agents/product.md` describe the real login (username/
  password, JWT `access_token` cookie, rotating refresh token) and mention the login modal + the
  device-authorization option.
- `docs/agents/modules/auth.md` documents the login modal and the full device-authorization flow:
  the `auth_authorization_requests` entity, the five endpoints, the `open → approved → logged`
  status machine, the scoped poll token, enumeration safety, and the hardening limits.
- `docs/agents/backend/routes/auth.md` gets the same full per-endpoint reference (request/
  response, HTTP status, source files) for the five new endpoints, matching how the four classic
  auth routes are already documented there — `modules/auth.md` continues to hold the compact
  table + narrative and link out to it, per the existing convention.
- `docs/agents/architecture/backend.md` gains a new "Owned tables" section (none exists there
  today — the per-module table catalog currently only lives in `modules/auth.md`'s own "Entities"
  section) listing each module's owned tables by prefix, including `auth_authorization_requests`
  under Auth.
- The new environment variables are documented wherever env vars are catalogued
  (`docs/agents/environment-variables.md`, which already has a row for
  `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` — only the sub-issue 8 rate-limit/cap keys are missing:
  `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT`, `KERGHAN_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS`,
  `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER`,
  `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS`,
  `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS`).
- `.claude/agents/frontend.md` reflects that a real modal-based auth UI, routing, client layer,
  and specs exist (its whole "Current state" section is stale, not just the "skeleton" sentence).

## Solution

### Scope

Documentation only — no code. Update the stale files, add the new-flow documentation, and catalog
the new env vars.

Explicitly **out of scope**:

- Any behaviour change or code edit outside `*.md` (and `.claude/agents/*.md`).
- Rewriting docs unrelated to auth / the frontend-skeleton claim (e.g. `flow.md`'s broader
  "no models, routes, or components for any of this yet" status line, which is still true for the
  non-auth steps of the flow).

### What needs to be done

- **Correct the stale copy**: `AGENTS.md` (both the line-36 skeleton sentence and the opening
  paragraph's "just a GitHub handle" claim), `.claude/agents/frontend.md` (rewrite "Current state"
  to reflect the real modal/routing/client/specs), `docs/agents/folder-structure.md`, `README.md`
  (the frontend-skeleton line **and** the adjacent Express/Sequelize backend claim, plus its
  Project Structure tree), `docs/agents/architecture/frontend.md` (resolve its
  directory-layout-vs-auth-flow contradiction), `docs/agents/flow.md` (step 1 only),
  `docs/agents/product.md` (the "decided" login bullet).
- **Document the new flow** in `docs/agents/modules/auth.md`: routes table extended with the five
  `POST /auth/authorization-requests…` endpoints (method, path, auth, request/response, kept
  compact, linking to `backend/routes/auth.md` for full detail); the entity; the status machine +
  atomic `approved → logged` claim; the scoped poll-token contract; the enumeration-safety notes;
  the login modal as the single entry point (pages removed); the hardening limits from sub-issue 8.
- **Extend `docs/agents/backend/routes/auth.md`** with full per-endpoint tables (request/response,
  HTTP status, source files) for the five new endpoints, matching the existing four routes' format.
- **Add an "Owned tables" section to `docs/agents/architecture/backend.md`**: a small per-module
  table-ownership summary (table prefix → module), including `auth_authorization_requests` under
  Auth, noting `user_id` is a logical FK.
- **Catalog env vars** in `docs/agents/environment-variables.md`: add the five sub-issue 8
  rate-limit/cap/cool-off keys listed above, with their defaults and source files (mirroring the
  existing `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` row's format).
- Cross-check `docs/agents/flow.md`'s "Open questions" ("exact session mechanism") — update or
  remove the now-answered part.

### Acceptance criteria

- [ ] `AGENTS.md` (both the skeleton sentence and the opening "just a GitHub handle" claim),
      `.claude/agents/frontend.md`, `docs/agents/folder-structure.md`, `README.md` (frontend
      skeleton line and the adjacent Express/Sequelize backend claim) and
      `docs/agents/architecture/frontend.md` no longer call the frontend a "tooling-only
      skeleton", no longer say login is "just a GitHub handle", and `architecture/frontend.md`
      no longer contradicts itself.
- [ ] `docs/agents/flow.md` step 1 and `docs/agents/product.md` describe username/password login
      with a JWT cookie + rotating refresh token, and mention the login modal + device
      authorization.
- [ ] `docs/agents/modules/auth.md` documents the login modal and the device-authorization flow:
      entity, all five endpoints (compact table + narrative), status machine, poll-token
      contract, enumeration safety, and hardening limits.
- [ ] `docs/agents/backend/routes/auth.md` documents the five new endpoints with the same
      per-endpoint detail (request/response, HTTP status, source files) as the existing four.
- [ ] `docs/agents/architecture/backend.md` has a new "Owned tables" section listing
      `auth_authorization_requests` (and the Auth module's other tables) with the logical-FK note.
- [ ] `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT`, `_CREATE_WINDOW_MS`, `_MAX_OPEN_PER_USER`,
      `_AUTHORIZE_MAX_ATTEMPTS`, and `_AUTHORIZE_LOCK_MS` are documented with their defaults in
      `docs/agents/environment-variables.md` (`_TTL_MS` is already there).
- [ ] No non-`.md` files are changed; docs lint/format (if any) passes.

## Benefits

- Removes a long-standing source of confusion for anyone (human or agent) reading the docs to
  understand Kerghan's auth.
- Gives the device-authorization flow a single canonical reference, at both the compact
  (`modules/auth.md`) and full-detail (`backend/routes/auth.md`) levels, consistent with how the
  classic auth routes are already documented.
- Records the new configuration surface so operators can tune TTL, rate limits, and lockout
  behavior.
