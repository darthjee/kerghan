# Plan: Specs: repositories — GitHub handle and default user

Issue: [449-specs-repositories-github-handle-and-default-user.md](../../issues/449-specs-repositories-github-handle-and-default-user.md)

## Overview

Settle every "Open — settled by #449" marker in `docs/agents/specs/repos/`: the
`auth_users.github_handle` column (type, validation, normalisation, URL-encoding), how it is
read and set (a handle-only `PATCH /auth/account.json` that needs no current password, a new
account read route, an Auth export for Repositories), the narrowed default-user block, admin
visibility (none), and what happens to the handle source's stored rows when the handle changes
or is cleared (lazy reconciliation on the Repositories side). Specs only: no code, and no
permanent docs (those changes go onto #452's checklist).

## Context

- Epic #444; spec-enhancement sub-issue after #445, #446, #447 (merged). #448 is being worked in
  parallel on `issue-448` and touches the same folder (README tables, `model.md`, `sync.md`,
  `security.md`); stay out of its markers and expect README merge conflicts.
- Facts from the code (backend/frontend exploration):
  - `UpdateAccountDto` (`backend/src/auth/dto/update-account.dto.ts`) requires `currentPassword`
    on **every** edit; `UserFieldChangesDto` has `username`, `email`, `newPassword`.
  - `assertAnyFieldPresent` / `hasManagedField` (`assert-any-field-present.ts`);
    `MANAGED_FIELDS = ['username','email','newPassword']`.
  - `AccountService.updateAccount` order: any-field → default-user block → lockout (`423`) →
    load user → current password / availability (count as failures) → apply → reset → revoke on
    password change. Response `{ username, email }`.
  - No account read route exists; the Account page is not prefilled. `status.json` returns only
    `{ loggedIn, isAdmin }`.
  - Auth exports only `AuthService` and `SESSION_LOOKUP`.
  - The default user's password comes from the environment (standalone generates a random one),
    so a handle edit that needs `currentPassword` would be impossible for most default users.
  - Frontend: `MyAccountController` / `AccountEditFormController` / `AccountEditFormHelper`;
    server errors show only `error.message` as a submit alert; `error.details` is never shown.
    Admin edit form: username, email, new password; admin list: ID, username, email, admin,
    status.

## Decisions (source of truth for the steps)

- **Column:** `github_handle varchar(39) NULL`, no index, no uniqueness (two Kerghan accounts may
  share a handle; a unique index would reveal who uses which handle).
- **Normalisation, in order:** trim; strip one leading `@`; empty ⇒ `null`; lowercase (GitHub
  logins are case-insensitive, so the stored form is canonical and comparisons are plain
  equality).
- **Validation** (after normalisation): `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$` — letters,
  digits, single hyphens, no leading/trailing hyphen, 1–39 characters. Anything else:
  `400 VALIDATION_FAILED` (standard shape), field message `githubHandle must be a valid GitHub
  username`. Non-string, non-null ⇒ `400`.
- **URL-encoding:** `encodeURIComponent` whenever interpolated into a GitHub path (defence in
  depth; the format already excludes path characters).
- **Write:** `PATCH /auth/account.json` gains optional `githubHandle: string | null`.
  - `assertAnyFieldPresent` counts `githubHandle` as present when the key is present (including
    `null`); message `At least one of username, email, newPassword or githubHandle is required`.
  - `currentPassword` becomes required **only when a managed field is present**. A handle-only
    edit sends no `currentPassword` (ignored if sent), skips the lockout check and the password
    check, never counts as a failure and never resets the counter. Rationale: the handle is a
    public, non-credential preference; the default user cannot know its password.
  - A mixed edit (managed field + handle) follows the full existing path; the handle is applied in
    the same write, all or nothing.
  - Response becomes `{ username, email, githubHandle }`.
- **Read:** new `POST /auth/account/mine.json` (JwtGuard, `@CachePolicy(CacheClass.Never)`,
  covered by `OriginGuard`) → `{ username, email, githubHandle }`. Lets the Account page prefill
  the handle field (and show the current username/email as placeholders).
- **Default user:** `github_handle` is not managed. The block stays "per field, by presence":
  `409 DEFAULT_USER_MANAGED` only when a managed field is present; a handle-only edit passes. A
  mixed edit is refused whole (nothing applied). The "every editable field is managed today"
  rationale is replaced: with an unmanaged field now editable, `error.details` still adds nothing
  because the rule is decidable client-side from the request (managed fields are fixed and
  documented); a read-side indicator stays out of scope. Boot sync never writes the handle.
- **Admins:** `/admin/users/*` neither show nor edit the handle; `githubHandle` in
  `POST /admin/users/:id/edit.json` is rejected `400` by the existing whitelist validation
  (`forbidNonWhitelisted`), confirm during review; the admin forms are unchanged. Rationale:
  the handle drives only the user's own listing, which admins cannot see.
- **Auth export for Repositories:** a new exported `AccountHandleService#getGithubHandle(userId):
  Promise<string | null>` (name final in the spec); Repositories never reads `auth_users`.
- **Handle changes — lazy reconciliation:** `repositories_sync_states` gains
  `handle varchar(39) NULL`, the handle the stored `handle` source rows belong to.
  - Every Repositories entry point that reads or writes the handle source (listing, sync state,
    Refresh, Add, and the sync run at start) first compares the current handle (Auth export) with
    `sync_states.handle`. When they differ, one transaction (locking the sync-state row) drops the
    `handle` source, page and status rows, sets `handle` to the current value, and prunes. A new
    handle then reads `pending`; a cleared handle has no handle source at all.
  - **Mid-sync guard:** the run records the handle it started with; each handle-source page
    transaction's step 1 adds `AND handle <=> :runHandle`. Zero rows while the `run_id` still
    matches ⇒ the handle changed: the handle source stops, writing nothing (no status), and the
    rest of the run continues. The remaining mid-sync matrix stays #450's.
  - No event from Auth: Auth would otherwise depend on Repositories, which already depends on
    Auth; the handle source holds only public metadata, so the lag until the next Repositories
    request has no privacy cost. Rejected: an `emitAsync` event like #448's `integration.deleted`
    (needed there because private metadata must go at once).
  - Changing the handle does not trigger a sync and is not bound by the Refresh cooldown; the
    new handle is fetched on the next stale listing or Refresh.
- **Frontend:** a separate "GitHub handle" section on `#/account/my-account` with its own input
  and Save button, prefilled from `mine.json`, sending only `{ githubHandle }` (empty ⇒ `null`)
  without the current-password field; client-side validation with the message "Use letters,
  digits and single hyphens (max 39 characters)."; server errors as the section's submit alert;
  success "GitHub handle updated." / "GitHub handle removed.". The existing username/email/
  password form is unchanged except that it keeps requiring the current password.

## Steps

- [01 — model.md: the GitHub handle section and the sync-state column](plan/01-model.md)
- [02 — sync.md and api.md: reconciliation and the handle-change knock-ons](plan/02-sync-and-api.md)
- [03 — security.md and ui.md](plan/03-security-and-ui.md)
- [04 — README: markers, decisions, #452 checklist; consistency check](plan/04-readme-and-review.md)

## CI Checks

- Docs only; no backend/frontend job is affected. Check that relative links and anchors between
  the spec files resolve.

## Notes

- Replace each "Open — settled by #449" note with the decision; never leave the note beside it.
- Stay out of #448's markers (deletion-hook mechanism, endpoints, usable statuses), #450's
  (user-deletion cleanup, the mid-sync edge-case matrix beyond the guard above) and #451's.
- Permanent docs (`modules/auth/default-user.md`, `modules/auth.md`, `backend/routes/auth.md`)
  are not edited here: their changes go onto README's "Product changes folded by #452".
- Security review is due at implementation time (new route, changed password requirement).
