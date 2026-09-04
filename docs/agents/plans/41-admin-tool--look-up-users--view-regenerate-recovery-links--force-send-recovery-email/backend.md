# Backend Plan: Admin tool: look up users, view/regenerate recovery links, force-send recovery email

Main plan: [plan.md](plan.md)

## Shared contracts

- Must expose `isAdmin: boolean` on the `user` object returned by `/auth/login.json`,
  `/auth/register.json`, `/auth/refresh.json`, and on `/auth/status.json`'s response
  (`{ loggedIn, isAdmin }`) — the frontend has no other way to learn this.
- Must expose exactly these three admin endpoints, all `X-Skip-Cache: true`,
  `@AdminOnly()`-guarded:
  - `POST /admin/users/search.json` (body `{ q }`, `q` optional) → `{ users: [{ id, username,
    email, isAdmin, createdAt }] }`
  - `POST /admin/users/:id/recovery-link.json` → `{ resetUrl: string }`
  - `POST /admin/users/:id/send-recovery-email.json` → `{ sent: boolean }`

## Steps

- [01 — Expose isAdmin on auth responses](backend/01-expose-is-admin-on-auth-responses.md)
- [02 — Extract a reusable token-issuing method](backend/02-extract-reusable-token-issuing-method.md)
- [03 — Add AdminService](backend/03-add-admin-service.md)
- [04 — Add AdminController and wire into AuthModule](backend/04-add-admin-controller.md)
- [05 — Tests and docs](backend/05-tests-and-docs.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- No new TypeORM entity or migration is needed — this issue reuses `User` and
  `PasswordResetToken` as-is.
- No Tent proxy changes needed — `proxy/*_configuration/rules/backend.php` forwards any `.json`
  URI to the backend regardless of path, so the new `/admin/*.json` routes are reachable without
  proxy config changes. Still verify end-to-end through `kerghan_proxy`, not just `kerghan_app`
  directly, per `docs/agents/architecture/backend.md`'s routing convention.
- Everything here stays inside the existing `auth` module (not a new `admin` module): the
  `modular-pattern.md` rule ("a module never writes to another module's tables — reads happen
  only through the exported service") would force a separate `admin` module to go through
  `AuthService` for every `User`/`PasswordResetToken` access it needs, and this issue's own scope
  note ("no general admin-panel scaffolding beyond what this specific tool needs") argues against
  standing up a new module for a single tool this tightly coupled to Auth's own entities.
