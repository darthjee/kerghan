# Add the Auth routes page

Create `docs/agents/backend/routes/auth.md` (new `docs/agents/backend/routes/` folder), using the
content already drafted in the GitHub issue body (see the "Pre-drafted content for
`docs/agents/backend/routes/auth.md`" block in `docs/agents/issues/31-document-routes.md`'s
Solution section) verbatim:

- Intro paragraph: `AuthController` under `/auth`, all routes `@Public()`, business logic in
  `AuthService`.
- `## Endpoints` — one `###` subsection per route (`POST /auth/login.json`,
  `/auth/register.json`, `/auth/refresh.json`, `/auth/logout.json`), each with a
  Property/Value table (Controller, Auth, Request body, Success response, HTTP status) plus a
  short note where relevant (e.g. `user` shape for login/register, rotation/replay behavior for
  refresh).
- `## Shared behavior` — the `X-Skip-Cache: true` note and link to
  `docs/agents/architecture/proxy.md`'s "Cache bypass" section.
- `## Access token cookie` — the `httpOnly`/`secure`/`sameSite`/`maxAge` contract.
- `## Source files` — table mapping `auth/auth.controller.ts`, `auth/auth.service.ts`, and the
  three DTO files to their role.

## Files to Change

- `docs/agents/backend/routes/auth.md` — new file, per-endpoint Auth route reference.
