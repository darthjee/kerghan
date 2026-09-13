# Correct stale skeleton / GitHub-handle copy

Two stale claims run through the docs and must be scrubbed everywhere they appear:

1. **"Frontend is a tooling-only skeleton"** — false since the login modal, routing, client
   layer, and pages already exist (`frontend/assets/js/components/`, `client/`, `utils/routing/`).
2. **"Login is just a GitHub handle, no password"** — false since login is username/password +
   JWT `access_token` cookie + rotating refresh token (`backend/src/auth/auth.service.ts`).

Also fix `docs/agents/architecture/frontend.md`'s self-contradiction: its "Directory layout
(current)" section still lists only `App.jsx`/`main.jsx` as if nothing else exists, directly
below an "Auth flow" section that already documents real files (`client/AccountsClient.js`,
`components/common/header/Header.jsx`, etc.). Replace the directory layout with the real
top-level shape (or drop it in favor of a pointer to `.claude/agents/frontend.md`'s conventions),
and extend the "Auth flow" section with the login modal + device-authorization flow (link to
`docs/agents/modules/auth.md` for the endpoint-level contract rather than duplicating it).

`README.md`'s "Status" paragraph bundles the false frontend-skeleton claim with an equally false
"Express/Sequelize skeleton" backend claim in the same sentence (the backend is NestJS/TypeORM,
already correct in `docs/agents/folder-structure.md`) — fix both halves together so the paragraph
stays internally consistent, and update the "Project Structure" tree's `backend/`/`frontend/`
comment lines to match.

## Files to Change

- `AGENTS.md` — line 36's skeleton sentence, and the opening paragraph's "no GitHub OAuth yet —
  just a GitHub handle" claim (rewrite to describe real username/password login + the login
  modal/device-authorization option, keeping it brief — full detail lives in `docs/agents/flow.md`
  and `docs/agents/modules/auth.md`).
- `.claude/agents/frontend.md` — rewrite the "Current state" section (currently says "no real
  components, client, or router exist yet") to describe the real modal-based auth UI, hash
  routing, `client/` layer, and Jasmine specs that exist today.
- `docs/agents/folder-structure.md` — line 8's `frontend/` row ("currently a tooling-only
  skeleton").
- `README.md` — the "Status" paragraph (skeleton claims for both backend and frontend) and the
  "Project Structure" tree's `backend/`/`frontend/` comments.
- `docs/agents/architecture/frontend.md` — replace the stale "Directory layout (current)" section
  and extend "Auth flow" with the login modal + device-authorization flow (linking to
  `docs/agents/modules/auth.md`, not duplicating its content).
- `docs/agents/flow.md` — step 1 ("Login"): rewrite to describe username/password + JWT cookie +
  rotating refresh token, and mention the login modal and the device-authorization option as an
  alternative entry point. Also update the "Open questions" section: "Exact session mechanism
  behind 'login' (cookie? something else?) is not yet decided" is now answered — remove it or
  replace it with any genuinely still-open session question, if one exists.
- `docs/agents/product.md` — the "decided" bullet describing login (mirror the same
  username/password + JWT + login modal + device-authorization description used in `flow.md`).
