# Issue: Repositories: Auth — GitHub handle on the account

## Description
Part of Epic #444 (repositories listing), implementation slice **A**. It adds an optional **GitHub handle** to the Kerghan account. The handle's public repositories are one source of the Repositories listing.

Spec: `docs/agents/specs/repos/model.md#github-handle` (column, normalisation, validation, setting, reading, default user, admins, Auth export), plus `security.md#github-handle`.

**Depends on:** nothing. It can run in parallel with #461 and #462.
**Blocks:** #463 (Repositories module) and #465 (Account page handle field).

## Problem
The account has no GitHub handle. Repositories (#463) needs it to list the user's public repos, and every editable account field is managed for the default user today, so the default user could not set one.

## Expected Behavior
- There is a nullable `github_handle varchar(39)` on `auth_users`, added by a migration, with no uniqueness constraint.
- Normalisation: trim, strip one leading `@`, lowercase, and empty ⇒ `null`. Validation follows GitHub's username format, per `model.md#validation`.
- `PATCH /auth/account.json` accepts `githubHandle`:
  - a handle-only edit needs no `currentPassword` and skips the abuse guard;
  - `currentPassword` is required only when managed fields change;
  - the response is `{ username, email, githubHandle }`;
  - the `assertAnyFieldPresent` message is updated for the account edit only (the admin message is unchanged);
  - `null` for a managed field answers `400`, and a no-op handle edit skips the `UPDATE`.
- A new `POST /auth/account/mine.json` reads the session's own `{ username, email, githubHandle }`, with `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache`) and `OriginGuard`.
- The default-user `409` is narrowed to the managed fields, so the default user can set the handle. Boot sync never touches it.
- Admins neither see nor edit the handle: the admin routes are unchanged.
- Auth exports `AccountHandleService#getGithubHandle(userId)` for Repositories.

## Solution
Backend only, inside the Auth module (`backend/src/auth/`). Follow `model.md#github-handle` subsection by subsection, and its "Required tests" section (and `security.md`'s handle tests).

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in.
- Every test this slice owns, as listed in the "Required tests" sections named below, is written and passes; tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`.

### Shared helpers and the admin path

- **`assertAnyFieldPresent` is parametrised per caller.** It takes the list of fields that count:
  - the account edit (`AccountService`) passes `username`, `email`, `newPassword` and `githubHandle`, with the spec's message `At least one of username, email, newPassword or githubHandle is required`;
  - the admin edit (`AdminService#editUser`) keeps the three fields and today's message, so admins never see `githubHandle` named.
  - Presence for `githubHandle` means the key is in the body, `null` included.
- **`githubHandle` lives on `UpdateAccountDto` only**, never on the shared `UserFieldChangesDto`, so the admin contract (`AdminUpdateUserDto`) is unchanged.
  - `currentPassword` becomes optional on `UpdateAccountDto`. `AccountService` requires it only when a managed field is present (`hasManagedField`), answering `400` when it is missing.
- **Admin route:** a `githubHandle` sent to `POST /admin/users/:id/edit.json` is stripped by the global `ValidationPipe` (`whitelist: true`, no `forbidNonWhitelisted`) and is never written. A body holding only `githubHandle` therefore answers `400` (no field present). Tests assert both. The pipe configuration is unchanged.

### Edge cases

- **`null` managed fields are rejected.** On `PATCH /auth/account.json`, `null` for `username`, `email` or `newPassword` answers `400 VALIDATION_FAILED`. Only `githubHandle` accepts `null`, meaning clear. So `{ username: null, githubHandle: "x" }` can never reach the handle-only path. `hasManagedField` keeps its current check, because `null` never reaches it.
- **No-op handle edit:** when the normalised value equals the stored one (same value, a case-only change, or an `@`-only change), the edit answers `200` with the stored value and skips the `UPDATE`.
- **Default user disabled:** with the default-user feature off, that user's row is an ordinary user, and both the handle and the managed fields are editable as usual. This is covered by a test.

### Scope and backward compatibility

- **Backend only.** No frontend change: the Account page field and its client methods belong to #465.
  - The current Account form (`frontend/assets/js/client/AccountsClient.js`) always sends `currentPassword` and reads only `{ username, email }`.
  - Both changes are therefore additive: the new `githubHandle` response field, and `currentPassword` becoming optional for handle-only edits. The existing frontend keeps working unchanged.
- **In scope:**
  - `@CachePolicy(CacheClass.Never)` on `POST /auth/account/mine.json`, with the cache-policy coverage spec updated;
  - `navi/` is unchanged;
  - any divergence from `docs/agents/specs/repos/model.md` is written back to the spec in the same PR.
- **Out of scope:**
  - the handle-change reconciliation, owned by the Repositories module (#463), which reads the handle through `AccountHandleService`;
  - the permanent Auth docs (`modules/auth.md`, `modules/auth/default-user.md`, `backend/routes/auth.md`), folded by #452.

### Testing and security

- **Tests owned by #460:**
  - every item of `docs/agents/specs/repos/model.md` "Required tests → GitHub handle" (the handle-reconciliation items belong to #463);
  - this issue's decisions: `null` managed fields answer `400`, the no-op handle edit skips the `UPDATE`, the default-user-disabled case, and the per-caller `assertAnyFieldPresent` message (the admin message is unchanged);
  - the cache-policy coverage spec for `POST /auth/account/mine.json`.
  - Unit specs cover the services (`AccountService`, `AccountHandleService`, normalisation and validation); e2e specs cover the routes.
- **Migration:** follows the existing migration and spec conventions. #462 (DB-backed tier) runs in parallel, so #460 does not depend on it. Once #462 lands, #463's migration db-specs also cover the `auth_users.github_handle` column.
- **No rate limit on the handle-only path**, as `security.md#github-handle` reasons: it is authenticated, it writes one public field of the caller's own row, and it triggers no sync and checks no password.

## Benefits
- Unblocks the Repositories module (#463) and the Account page field (#465).
- The default user can set a handle without knowing its generated password, and the handle-only path is no password oracle.
- The admin contract and the existing Account form keep working unchanged.
