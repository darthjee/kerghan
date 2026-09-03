# Issue: Add admin role concept to user accounts

## Description
Kerghan's `User` entity (`backend/src/auth/entities/user.entity.ts`, table `auth_users`) has no role or permission concept today — every account is equivalent. This issue introduces a minimal admin concept as the foundation for staff-only tooling. The first consumer is the admin password-recovery tool (follow-up issue); this issue delivers only the data model plus the authorization primitive.

Surfaced while enhancing #36 (password recovery flow). The recovery-token model is what the admin tool will operate on, but the admin concept itself is independent, general infrastructure.

## Problem
- No way to distinguish a staff/admin account from a regular one.
- No authorization primitive to restrict a route to admins, so staff-only tooling cannot be built.
- No admin-provisioning story anywhere in the codebase.

## Expected Behavior
- `User` carries a boolean admin flag, persisted via a migration following the conventions in `backend/src/database/migrations/` (TypeORM `Table`/`TableColumn` API, timestamped filename + class suffix, `auth_` table prefix, logical FKs only).
- An `@AdminOnly()` decorator + guard, mirroring the existing `@Public()` decorator / global `JwtGuard` pattern in `backend/src/core/`, rejects non-admin accounts with 403 and unauthenticated requests with 401.
- The admin guard runs after the global `JwtGuard` and reads the admin status straight off `request.user` — no per-request DB lookup.
- No admin UI, routes, or admin-only features ship in this issue.

## Solution
### Data model
- Add `is_admin` (boolean, `NOT NULL`, default `false`) to `auth_users` via a new migration in `backend/src/database/migrations/`, following existing conventions.
- Add the matching `@Column({ name: 'is_admin', default: false }) isAdmin!: boolean` to the `User` entity.

### Authorization primitive
- Add an `isAdmin` claim to the signed access-token payload (`auth.service.ts` currently signs `{ sub, username }` at the `#issueTokens`/`sign` call) so it is present on `request.user` after `JwtGuard` verification. The claim is refreshed on every login / register / refresh.
  - Accepted trade-off: a demoted admin keeps admin access until their current access token expires. Acceptable given short access-token TTL and the low blast radius of the initial tooling.
- Add `@AdminOnly()` in `backend/src/core/` (`SetMetadata`-based, same shape as `@Public()`) plus an `AdminGuard` that reads the `@AdminOnly()` metadata via `Reflector` and checks `request.user.isAdmin`. Register it so it runs after `JwtGuard`; unauthenticated → 401 (already handled by `JwtGuard`), authenticated non-admin → 403.

### First-admin provisioning
- No general provisioning code path. Document the manual step (`UPDATE auth_users SET is_admin = true WHERE username = '…';`) in the backend docs.
- Local development only: extend the existing `auth-seed-demo-user` migration so the seeded `demo` user is created with `is_admin = true`, keeping admin tooling exercisable out of the box. This stays behind the migration's existing `STAGE=production` guard.

### Ownership
- `backend` agent implements; `security` agent reviews. No new top-level folder.

## Benefits
- Unblocks staff-only tooling, starting with the admin password-recovery tool.
- Establishes a single, reusable authorization primitive rather than ad-hoc per-route checks.
- Minimal and additive: one column, one decorator + guard, one claim, a doc note, and a one-line change to an existing seed migration.
