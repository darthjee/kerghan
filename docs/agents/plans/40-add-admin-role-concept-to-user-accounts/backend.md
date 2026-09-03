# Backend Plan: Add admin role concept to user accounts

Main plan: [plan.md](plan.md)

## Overview

`User` (`backend/src/auth/entities/user.entity.ts`, table `auth_users`) has no role concept.
This plan adds:

- `is_admin` boolean column on `auth_users` (`NOT NULL`, default `false`) + matching entity field.
- An `isAdmin` claim on the signed access token, so it is available on `request.user` after
  `JwtGuard` runs — no per-request DB lookup. The claim is (re)issued on every
  login / register / refresh, all of which already funnel through `AuthService#issueTokens`.
- `@AdminOnly()` decorator + `AdminGuard` in `backend/src/core/`, registered as a global
  `APP_GUARD` in `AppModule` **after** `JwtGuard`. No-op unless `@AdminOnly()` metadata is
  present; otherwise 403 for an authenticated non-admin (401 for unauthenticated is already
  handled by `JwtGuard`).
- First-admin provisioning: a documented manual `UPDATE`. Local dev only: a dev-only migration
  promotes the seeded `demo` user to admin.

## Context

- **Guard/decorator pattern to mirror**: `core/public.decorator.ts` (`SetMetadata`-based
  `@Public()`) + `core/jwt.guard.ts` (global `APP_GUARD` reading the metadata via `Reflector`,
  sets `request.user` from the verified JWT). `AppModule` registers `JwtGuard` as
  `{ provide: APP_GUARD, useClass: JwtGuard }`.
- **Token payload today**: `AuthService#issueTokens` (`auth.service.ts:244`) signs
  `{ sub: user.id, username: user.username }`. `JwtGuard#verify` returns the decoded payload
  (typed `object`) and assigns it to `request.user`. `src/types/express.d.ts` types
  `Request.user` as `user?: object`.
- **All three token-issuing flows** (`login`, `register`, `refresh`) call `#issueTokens(user)`
  with a `User` loaded from the repository, so reading `user.isAdmin` there is sufficient —
  `refresh` re-loads the user via `userRepository.findOneBy({ id })`, so the claim self-corrects
  on the next refresh after a promotion/demotion.
- **Migration conventions** (`backend/src/database/migrations/`): filename
  `<timestamp>-<module>-<action>.ts`, class name suffixed with the same timestamp,
  `implements MigrationInterface`, `auth_` table prefix, logical FKs only. Latest existing
  timestamp is `20260901120005`. `20260824120004-auth-seed-demo-user.ts` is the precedent for a
  dev-only, `STAGE=production`-gated data migration using raw `queryRunner.query(...)`.
- **Migration ordering constraint**: the seed-demo-user migration (`...120004`) necessarily runs
  *before* any new add-column migration. On a fresh database the `demo` row is inserted before
  `is_admin` exists, so the `demo` user cannot be made admin by editing that migration's
  `INSERT` — it needs a *later* migration. See Notes.
- **Serialization**: `auth.controller.ts#serialize` returns `{ id, username, email }`. Exposing
  `isAdmin` in API responses is out of scope — leave `#serialize` unchanged.
- **Testing**: no live DB in CI. Unit specs use `jest.fn()` repository doubles; e2e specs use
  `Test.createTestingModule` with `getRepositoryToken(Entity)` overrides + `supertest`. There is
  currently **no** `jwt.guard` unit spec — guard behavior is exercised via the auth e2e spec.
  Migrations themselves are not executed by any spec.

## Steps

- [01 — Add `is_admin` column and entity field](backend/01-add-is-admin-column.md)
- [02 — Add `isAdmin` access-token claim and payload type](backend/02-add-is-admin-jwt-claim.md)
- [03 — Add `@AdminOnly()` decorator and global `AdminGuard`](backend/03-add-admin-only-guard.md)
- [04 — Promote the seeded `demo` user to admin (dev only)](backend/04-promote-demo-user-to-admin.md)
- [05 — Update module and architecture docs](backend/05-update-docs.md)

## CI Checks

Run from `backend/`:

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- **Deviation from the issue's "extend the existing seed migration" wording**: because the
  add-column migration runs *after* `20260824120004-auth-seed-demo-user.ts`, editing that
  migration's `INSERT` to set `is_admin` would break a fresh `yarn migration:run` (unknown
  column at that point). Step 04 instead adds a new, later, `STAGE=production`-gated migration
  that `UPDATE`s the `demo` row. Same net effect for local dev, migration-order-safe.
- **Staleness trade-off (accepted)**: a demoted admin keeps admin access until their current
  access token expires (`KERGHAN_ACCESS_TOKEN_TTL_MS`, default 15 min). The next
  refresh/login re-reads `user.isAdmin` and drops the claim. Acceptable given the short TTL and
  the low blast radius of the initial tooling.
- **Global guard order**: `AdminGuard` must be listed in `AppModule`'s `providers` array
  *after* the `JwtGuard` `APP_GUARD` entry — Nest runs multiple `APP_GUARD`s in registration
  order, and `AdminGuard` depends on `request.user` being populated by `JwtGuard`.
- **`@AdminOnly()` + `@Public()` on the same route** is contradictory (`@Public()` skips
  `JwtGuard`, so `request.user` is unset). `AdminGuard` treats a missing `request.user` as
  forbidden (403). Do not combine the two.
- **No new routes** in this issue, so nothing to wire into Tent's `.json` routing rule or the
  `X-Skip-Cache` convention — consumer issues that add admin routes must handle that.
- **MySQL boolean**: TypeORM `type: 'boolean'` maps to `tinyint(1)`; `default: false` becomes
  `DEFAULT 0`. Entity field typed `boolean`.
