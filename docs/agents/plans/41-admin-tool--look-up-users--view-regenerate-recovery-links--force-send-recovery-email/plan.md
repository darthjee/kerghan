# Plan: Admin tool: look up users, view/regenerate recovery links, force-send recovery email

Issue: [41_admin-tool--look-up-users--view-regenerate-recovery-links--force-send-recovery-email.md](../../issues/41-admin-tool--look-up-users--view-regenerate-recovery-links--force-send-recovery-email.md)

## Overview

Adds a staff-only tool, gated behind the `@AdminOnly()` guard from #40, to search user accounts,
generate a fresh password-recovery link for a user, and force-send the recovery email — all
reusing the `PasswordResetToken` model and `MailService` from #36/#38/#39 rather than introducing
new machinery. Backend adds admin-only endpoints inside the existing `auth` module (the natural
owner of `User`/`PasswordResetToken`); frontend adds an admin-only page and extends the app's auth
state to know whether the current user is an admin, since nothing today exposes that to the
browser.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

**New admin endpoints** (backend exposes, frontend calls) — every response sets
`X-Skip-Cache: true`, per the existing `auth` module convention, since responses carry
per-request secrets/PII that must never be cached by Tent's `default_proxy` rule:

- `POST /admin/users/search.json` (body `{ q }`, `q` optional) → `{ users: [{ id, username,
  email, isAdmin, createdAt }] }`. `q` matches against `username`/`email`. `POST`, not `GET`,
  matching this app's existing convention of using `POST` with a JSON body even for read-only
  checks (e.g. `/auth/status.json`) — the frontend's `ApiClient` has no `GET` support today (its
  single `#request` helper always attaches a JSON body, which `fetch` rejects outright on `GET`),
  so this avoids adding a second request shape for one endpoint.
- `POST /admin/users/:id/recovery-link.json` (`:id` = numeric user id) → `{ resetUrl: string }`.
  Always mints a fresh `PasswordResetToken` (no "view an existing link" — the token is
  hash-only, the plaintext can never be recalled) and does **not** invalidate the user's other
  outstanding tokens, matching current self-service semantics. 404 when the user id doesn't exist.
- `POST /admin/users/:id/send-recovery-email.json` → `{ sent: boolean }`. Mints a fresh token the
  same way, then calls `MailService.send(...)` **directly and synchronously** (not the
  fire-and-forget event path self-service uses) so the admin gets a real success/failure result.
  404 when the user id doesn't exist.

All three routes require a valid access token (default `JwtGuard` behavior — no `@Public()`) and
`@AdminOnly()`, returning `403` for a non-admin caller.

**`isAdmin` exposure on existing auth responses** (backend changes, frontend consumes) — this is
the only way the frontend can know to show/hide admin UI, since the access-token cookie is
`httpOnly`:

- `POST /auth/login.json`, `/auth/register.json`, `/auth/refresh.json` — the `user` object in the
  response gains `isAdmin: boolean`.
- `POST /auth/status.json` — response shape becomes `{ loggedIn: boolean, isAdmin: boolean }`
  (`isAdmin` is `false` whenever `loggedIn` is `false`).

## Notes

- `docs/agents/product.md` still says "No admin UI" under "What's already decided" — that line
  predates #40 (already merged, introduces the admin role/guard) and is now stale given both #40
  and this issue. Whichever step touches `docs/agents/modules/auth.md` for this issue should also
  correct that line in `docs/agents/product.md`, scoped narrowly to "an admin-role-gated UI is
  allowed" — not a full product.md rewrite (the data-model section stays open/unaffected).
- Audit logging and rate limiting on the new admin actions are explicitly out of scope for this
  issue, per the discuss-issue dialogue.
- Given this issue adds new endpoints, changes an authorization-relevant response shape
  (`isAdmin`), and returns a secret (`resetUrl`) in a JSON body, get this reviewed by the
  `security` and `data-access` agents before merge (both are read-only reviewers — this is a
  review step, not part of either agent's implementation plan file).
