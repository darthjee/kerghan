# Auth — Admin Authorization and Events

## Admin authorization

Routes (or whole controllers) requiring an admin account are annotated `@AdminOnly()`
(`core/admin-only.decorator.ts`), enforced by the global `AdminGuard` (`core/admin.guard.ts`),
registered as an `APP_GUARD` right after `JwtGuard`. `AdminGuard` never re-verifies the JWT — it
just reads `isAdmin` off `request.user`, which `JwtGuard` builds from the session's user row in
the database (not from the signed claim), so a demotion applies on the next request. Routes
without `@AdminOnly()` metadata are unaffected. An unauthenticated request already gets `401`
from `JwtGuard`; `@AdminOnly()` plus an authenticated non-admin gets `403` from `AdminGuard`.
`@AdminOnly()` and `@Public()` on the same route are contradictory — `@Public()` skips `JwtGuard`,
leaving `request.user` unset, which `AdminGuard` treats as forbidden.

`isAdmin` is exposed on the `user` object returned by `login`/`register`/`refresh`, and on
`/auth/status.json`'s response — see [Routes](routes.md#routes) — so the frontend can gate admin-only UI
(e.g. #41's user-lookup/recovery-link tool, `AdminController`) without decoding the `httpOnly`
access-token cookie itself.

**First admin**: there is no admin-provisioning endpoint or CLI. Promote an account manually,
directly against the database:

```sql
UPDATE auth_users SET is_admin = true WHERE username = '<username>';
```


## `user.registered` event

`AuthService#register` fires `user.registered` (via `EventEmitter2`) with a
`UserRegisteredEvent { userId, username, email }` payload on every successful registration — see
`events/user-registered.event.ts`. No listener consumes it yet; it exists so a future module
(e.g. a welcome-email or onboarding module) can react without `AuthService` knowing it exists,
per the modular pattern's event-driven communication rule.

## `user.deleted` event

`UserDeletedEvent { userId }` (`events/user-deleted.event.ts`, name `USER_DELETED` =
`user.deleted`) is the contract for deleting a user's data in other modules. The
[Repositories module](../repositories/data-model.md#user-deletion) listens and deletes the user's rows in its
five tables.

**Not built yet:** no user-deletion path exists today, so nothing emits the event. Whoever adds a
deletion path must emit it with `EventEmitter2#emitAsync` **after the user row's delete commits**,
and must retry it or run an orphan sweep, because a failed listener only logs and never blocks the
deletion (the same pattern as [`integration.deleted`](../integrations/github-service.md#deletion-hook)).

## `password-recovery.requested` event

`PasswordResetService#recover` fires `password-recovery.requested` (via `EventEmitter2`) with a
`PasswordRecoveryRequestedEvent { userId, token, resetUrl, email }` payload whenever a recovery
is requested for a known email — see `events/password-recovery-requested.event.ts`. It is
consumed in-module by `events/password-recovery-requested.listener.ts`, which renders the
`password-recovery` mail template and sends it through `MailService.sendEmailTemplate` (Mail
module, direct DI — `AuthModule` imports `MailModule`). Delivery is best-effort: the listener
swallows every send error (one `warn` line, `userId` only) and treats
a disabled-mail `{ status: 'skipped' }` as success, so a mail problem never affects the
already-responded `/auth/recover.json` request.


