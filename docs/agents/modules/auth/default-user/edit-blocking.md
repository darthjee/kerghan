# Default user: edit blocking

Part of the [Default user](../default-user.md) hub, itself part of the [Auth module](../../auth.md). Why and how the API refuses to edit the default user's managed fields.

## Edit blocking

While `isEnabled()` is true, the default user's managed fields must not change through the API.
Without the block, a rename would make the next boot create a second user (probably colliding on
email), and email and password edits would be silently reverted at boot.

The block lives in the services, not in the controllers. While `isEnabled()` is false, nothing is
blocked.

### What is blocked

- **Managed fields:** `username`, `email`, `newPassword` (the fields of `UserFieldChangesDto`;
  `hasManagedField` in `assert-any-field-present.ts`), plus the admin flag if an endpoint ever
  edits it. This list is the single source of truth for the managed fields; the only editable
  field outside it is `github_handle` ([GitHub handle](../github-handle.md)). The approval `status`
  is managed too: boot sync forces it to `approved`, and `POST /admin/users/:id/deny.json`
  answers `409 DEFAULT_USER_MANAGED` for the default user (after the `404` for an unknown id,
  before `CANNOT_DENY_SELF`); see [User approval → Default user](../user-approval.md#default-user).
- **Endpoints:**
  - `PATCH /auth/account.json` (self-edit, `AccountService.updateAccount`);
  - `POST /admin/users/:id/edit.json` (admin edit, `AdminService.editUser`);
  - `POST /auth/recover.json` and `POST /auth/reset-password.json` (`PasswordResetService`);
  - `POST /admin/users/:id/recovery-link.json` and
    `POST /admin/users/:id/send-recovery-email.json` (`AdminService`);
  - `POST /admin/users/:id/deny.json` (`AdminService.denyUser`, the `status` field);
  - any future write path (see [Future write paths](#future-write-paths)).

A blocked write answers `409 DEFAULT_USER_MANAGED` with the message
`This user is managed by environment configuration and cannot be edited`
(`DEFAULT_USER_MANAGED_MESSAGE`), the same on every endpoint. The message never names the
variables or their values. The body is the standard error shape, with no `error.details`; see
[Auth routes](../../../backend/routes/auth/shared.md#default-user-409-default_user_managed).

**Why no `error.details`:** the managed fields are a fixed, documented list, so a client can tell
from its own request which field caused the refusal, and the Account page sends the
[GitHub handle](../github-handle.md) from its own section, never mixed with managed fields. A
read-side indicator that disables the inputs before submitting is not built.

### Why `409`

- The request is well-formed and the caller is normally allowed to make it (the user editing
  themselves, or an admin). It is refused only because of the target's current state: the
  environment manages these fields. That is a conflict with state, not a permission problem.
- The block lifts when the configuration changes, which also fits "conflict with the current
  state".
- It matches the existing `409`s for state-based refusals (`INTEGRATIONS_LIMIT_REACHED`,
  `USERNAME_TAKEN`). The code name follows the same subject-plus-state pattern.

Rejected: `403` (implies the caller lacks permission, and the admin form redirects home on
`403`), `423` (`account.json` already uses it for the temporary abuse-guard lockout, so a
permanent block would look temporary), `422` (for invalid payloads; here the payload is valid).

### Identifying the default user

The default user is the row boot sync created or matched, identified **by id**, never by
comparing usernames.

- **Why:** `auth_users.username` uses MySQL's default collation (case- and accent-insensitive).
  Boot sync can match a stored `Admin` for a configured `admin`, which a strict string comparison
  would miss, bypassing the block.
- `DefaultUserService` holds the id in memory and exposes `isDefaultUser(userId)` and
  `assertNotDefaultUser(userId)`. Each instance resolves the id at its own boot, so no extra query
  is needed per request.

### Rule: per field, by presence

- A request whose target is the default user is rejected when it **contains any managed field**.
  A field added later that is not managed stays editable.
- `github_handle` is **not managed**: a handle-only edit by the default user passes the block and
  is applied like any user's (`200`). A **mixed** edit (a managed field and `githubHandle`) is
  refused whole with `409`: the handle is not stored either. See
  [GitHub handle](../github-handle.md#default-user).
- A request with no field present is still rejected earlier by `assertAnyFieldPresent` (`400`).
- **Presence, not value:** a managed field is blocked even when its value equals the stored one.
  **Why:** the response never confirms a stored value (a `409` vs `200` difference would, and for
  `newPassword` it would reveal whether a guess is the managed password), and no `bcrypt.compare`
  is needed to decide.

### Order of checks

The block runs early and never counts as a failed attempt.

`PATCH /auth/account.json` (`AccountService.updateAccount`):

1. `assertAnyFieldPresent` → `400`.
2. **Default-user block** → `409 DEFAULT_USER_MANAGED`, only when the body contains a managed
   field. It compares the session's `userId` with the default user's id, so no user load is
   needed. A handle-only edit skips steps 2, 3 and 5 and the abuse guard entirely
   ([GitHub handle](../github-handle.md#setting-it-patch-authaccountjson)).
3. Lockout check → `423`.
4. Load the user → `401` if missing.
5. `currentPassword` check → `400`, counts as a failure.
6. Username/email availability → `409 USERNAME_TAKEN` / `EMAIL_TAKEN`, counts as a failure.
7. Apply, reset the counter, revoke sessions on a password change.

Abuse-guard consequences:

- **No password oracle.** `currentPassword` is never checked for a blocked request, so the
  endpoint cannot be used to test guesses of the managed password.
- **Does not count.** A blocked edit never calls `registerFailure`: the outcome is always the
  same, and a retrying client must not fill the counter.
- **Not hidden by a lockout.** A locked-out default user still gets `409`, not `423`, because
  nothing would change after the cool-off.
- **No reset either.** A blocked edit leaves an existing lockout row untouched.

`POST /admin/users/:id/edit.json` (`AdminService.editUser`):

1. `assertAnyFieldPresent` → `400`.
2. Load the target user → `404` if missing.
3. **Default-user block** → `409 DEFAULT_USER_MANAGED`.
4. Username/email availability → `409`.
5. Apply, revoke sessions on a password change.

The admin endpoint has no abuse guard and no current-password check; the block only has to run
before any write.

### Password recovery and reset

A reset changes a managed field just like `newPassword`. Without a block, the new password would
work until the next boot, and whoever controls the configured email could take over the default
user (possibly an admin) until then.

| Endpoint | Default-user behavior |
|---|---|
| `POST /auth/recover.json` (public) | Unchanged response, `200 { sent: true }`, exactly as for an unknown email. No token is created and no email is sent (an `info` log line records the skip). **Why:** a `409` would reveal which email belongs to the default user. |
| `POST /auth/reset-password.json` (public) | The token is validated first, with its existing errors. A valid token for the default user → `409 DEFAULT_USER_MANAGED`, with no write: the password is unchanged and the token is not consumed (it simply expires). This covers tokens issued before the feature was enabled. |
| `POST /admin/users/:id/recovery-link.json` | After the existing `404` → `409`. No token is created. |
| `POST /admin/users/:id/send-recovery-email.json` | After the existing `404` → `409`. No token is created and no email is sent. |

None of these endpoints has an abuse guard, so there is no counter interaction.

### Edge cases

- **Configured username changed between boots.** The next boot creates (or matches) a user with
  the new username, and that row becomes the default user. The previous one becomes an ordinary,
  editable user.
- **Feature turned off, then on again.** While off, the default user is editable like any other.
  Edits made then are overwritten by the next enabled boot. This is intended.
- **The default user is an admin editing itself through the admin endpoint.** Blocked like any
  other caller: the block depends on the target, never on the caller.
- **Another user claims the default user's username or email.** Rejected by the existing
  uniqueness checks (`USERNAME_TAKEN` / `EMAIL_TAKEN`).

### Compatibility

- **Feature off (the default):** no behavior change on any endpoint.
- **Additive API change:** `DEFAULT_USER_MANAGED` is a new code in `ErrorCodes`
  (`backend/src/core/error-codes.ts`). The body shape, `http-exception.filter.ts` and every
  existing code and status are unchanged.
- **No reordering of existing checks:** `updateAccount` and `editUser` only gain one step.
- **Frontend works unchanged:** `MyAccountController`, `AdminUserEditController` and the login
  modal's reset-password mode (`LoginModalController`) show any non-`403` error's `error.message`
  as the submit error.
- **No migration.**

### Future write paths

- No endpoint edits `is_admin` today; only boot sync writes it.
- `status` is written only by boot sync (forced `approved`) and by the admin approve and deny
  routes; deny is refused for the default user, and approve never applies (it is always
  `approved`, so approve answers `422 USER_NOT_PENDING`).
- Any future endpoint or flow that writes a managed field of the default user (`username`,
  `email`, the password, the admin flag, or `status`) must apply the same block (`409 DEFAULT_USER_MANAGED`,
  same message and body, before any write) while `isEnabled()` is true. The only exception is a
  public endpoint that must not reveal which user is the default one: it follows the
  `recover.json` precedent (answer as for an unknown user, do nothing).

