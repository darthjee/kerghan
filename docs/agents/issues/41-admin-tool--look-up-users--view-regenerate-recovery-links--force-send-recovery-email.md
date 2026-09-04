# Issue: Admin tool: look up users, view/regenerate recovery links, force-send recovery email

## Description
A staff-only tool for looking up user accounts and managing their password recovery, mirroring Majora's admin "generate a recovery link for a user" tool. This is explicitly separate, admin-only functionality — not a replacement for the self-service recovery flow (#36) — and reuses the same `PasswordResetToken` model rather than introducing a new token type.

## Problem
Support/staff currently has no way to look up a user account or help a user recover access to it, other than direct database access. There is no admin-facing tool built on top of the admin role concept introduced in #40.

## Expected Behavior
- Staff can search/look up user accounts by identifying fields (e.g. username or email).
- Staff can request a recovery link for a given user. Since `PasswordResetToken` only ever stores a hash (never plaintext), there is no true "view an existing link" action — this always generates a fresh token and returns its link. Generating a new token does **not** invalidate the user's other outstanding tokens, matching current self-service (#36) semantics.
- Staff can force-send the recovery email for a user on demand, and get synchronous success/failure feedback in the response (unlike the self-service flow's best-effort, fire-and-forget event path).
- All of the above is only reachable by admin users: enforced by the `@AdminOnly()` guard on the backend, and reflected in the frontend by exposing `isAdmin` on an auth response and gating the relevant route/nav entry.
- Audit logging (who generated/sent what, for which user) and rate limiting on these actions are explicitly out of scope for this issue.

## Solution
- Backend: admin-only endpoint(s), guarded by `@AdminOnly()` (`backend/src/core/admin-only.decorator.ts`), to:
  - Search users (new repository query + DTO + serializer that excludes `passwordDigest`).
  - Generate a new recovery token for a user via `PasswordResetService` (`backend/src/auth/password-reset.service.ts`), returning its link. Adds a new token row without invalidating prior ones.
  - Force-send the recovery email by calling `MailService.send(...)` (`backend/src/mail/mail.service.ts`) directly and its content builder (`buildPasswordRecoveryEmail`), returning real success/failure — bypassing the existing best-effort event/listener path used by self-service.
  - Expose `isAdmin` on an existing or new auth response so the frontend can gate admin UI.
- Frontend: an admin-only page (following the existing Page/Controller/Helper convention used by the #36 recovery pages) to search users and drive token generation / email sending, reachable only when `isAdmin` is true.
- Authorization: gated behind the admin concept from #40 end-to-end, both on the backend guard and on frontend navigation/routing.

## Benefits
Lets support staff assist users with account recovery directly, without requiring direct database access or developer involvement.
