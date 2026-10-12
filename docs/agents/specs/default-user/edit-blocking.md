# Edit blocking on the default user

Implemented by #369 (contract by #374). Part of the [default-user specs](README.md).

This file is the API contract for **writes refused because the target is the default user, whose
fields are managed by environment configuration**. #369 implements it without making any API
decision of its own.

## Scope of the block

While `DefaultUserConfig.isEnabled()` is true ([configuration.md](configuration.md)), the default
user's managed fields must not change through the API.

- **Managed fields:** `username`, `email`, `newPassword` (the fields of `UserFieldChangesDto`), plus
  the admin flag if an endpoint ever edits it. This list is the single source of truth.
- **Endpoints covered:**
  - `PATCH /auth/account.json` (self-edit);
  - `POST /admin/users/:id/edit.json` (admin edit);
  - `POST /auth/recover.json`;
  - `POST /auth/reset-password.json`;
  - `POST /admin/users/:id/recovery-link.json`;
  - `POST /admin/users/:id/send-recovery-email.json`;
  - plus any future write path (see [Future write paths](#future-write-paths)).
- The blocking logic lives in the services, not in the controllers.

While `isEnabled()` is false, nothing is blocked.

## Identifying the default user

The default user is the row boot sync created or matched ([boot-sync.md](boot-sync.md)),
identified **by id**, never by comparing username strings.

- `auth_users.username` has no explicit collation, so it uses MySQL's default (case- and
  accent-insensitive). Boot sync's lookup can therefore match a stored `Admin` for a configured
  `admin`, which a strict `user.username === config.username()` check would miss, bypassing the
  block.
- Boot sync records the id of the row it created or matched, and the block compares ids (for
  example an `isDefaultUser(user)` helper). This needs no extra query per request, and each
  instance resolves the id at its own boot.
- #369 owns where the id is held. While `isEnabled()` is false, no id is held and nothing is
  blocked.

## Response

A blocked write of the default user returns **`409 Conflict`**.

- **Error code:** `DEFAULT_USER_MANAGED`. #369 adds
  `DEFAULT_USER_MANAGED: 'DEFAULT_USER_MANAGED'` to `ErrorCodes` in
  `backend/src/core/error-codes.ts`. The throw site attaches it, following the existing convention
  (`new ConflictException({ code: ErrorCodes.DEFAULT_USER_MANAGED, message })`). It mirrors the
  subject-plus-state naming of `USERNAME_TAKEN` and `INTEGRATION_CREDENTIAL_LOCKED`.
- **Message:** `This user is managed by environment configuration and cannot be edited`. The same
  text on every endpoint that returns this `409`. It never names the `KERGHAN_DEFAULT_USER_*`
  variables or their values.
- **Body:** the standard shape produced by `http-exception.filter.ts`, with no new top-level
  members:

  ```json
  {
    "error": {
      "code": "DEFAULT_USER_MANAGED",
      "message": "This user is managed by environment configuration and cannot be edited"
    },
    "statusCode": 409,
    "timestamp": "<ISO 8601>"
  }
  ```

- **No `error.details`.** The response does not list the managed fields. The error code alone tells
  the client the user is managed, and every editable field is managed today, so a list would add
  no information. A frontend that wants to disable the inputs needs to know **before** submitting;
  that belongs in a future read-side indicator (out of scope of #366). No change to
  `http-exception.filter.ts` is needed: it fills `details` only from `ValidationPipe` message
  arrays.

### Why `409`

- The request is well-formed and the caller is normally authorized to make it (the user editing
  themselves, or an admin). It is refused only because of the target's current state: the
  environment manages these fields. That is a conflict with state, not a permission problem.
- The block lifts when the configuration changes (`isEnabled()` becomes false), which also fits
  "conflict with the current state".
- It matches the codebase's existing use of `409` for state-based refusals (for example
  `INTEGRATIONS_LIMIT_REACHED`, `USERNAME_TAKEN`).

Rejected alternatives:

- **`403 Forbidden`**: implies the caller lacks permission, which blurs the existing auth semantics.
- **`423 Locked`**: `PATCH /auth/account.json` already returns `423` for the abuse-guard cool-off
  ("try again later"). Clients would mistake a permanent block for a temporary lockout.
- **`422 Unprocessable Entity`**: used for semantic validation failures of the payload. Here the
  payload is valid; the target is what makes it unacceptable.

## Rule: per field, by presence

- While `isEnabled()` is true, a request whose target is the default user is rejected with
  `409 DEFAULT_USER_MANAGED` when it **contains any managed field**. A field added later that is
  not managed stays editable without a spec change.
- **Today all editable fields are managed**, so every edit request reaching the default user is
  rejected in practice.
- A request with no field present is still rejected earlier by the existing
  `assertAnyFieldPresent` (`400`), unchanged.
- **Presence, not value:** a managed field is blocked even when its value equals the stored or
  configured one (for example `email` equal to the configured email). The decision never compares
  values, so:
  - the response never confirms the stored value (a 409 vs 200 difference would, and for
    `newPassword` it would reveal whether a guess is the managed password);
  - no `bcrypt.compare` against the managed password is needed to decide.

## Order of checks

The default-user block runs **early** and **never counts as a failed attempt**.

### `PATCH /auth/account.json` (`AccountService.updateAccount`)

1. `assertAnyFieldPresent` → `400` (unchanged).
2. **Default-user block** → `409 DEFAULT_USER_MANAGED`. It compares the session's `userId` with the
   default user's id, so no user load is needed and the existing steps keep their order.
3. Lockout check → `423` (unchanged).
4. Load the user → `401` if missing (unchanged).
5. `currentPassword` check → `400`, counts (unchanged).
6. Username/email availability → `409 USERNAME_TAKEN` / `EMAIL_TAKEN`, counts (unchanged).
7. Apply, reset the counter, revoke sessions on a password change (unchanged).

Abuse-guard consequences:

- **No password oracle.** `currentPassword` is never checked for a blocked request, so the endpoint
  can't be used to test guesses of the managed password (a 400-vs-409 difference would allow that).
- **Does not count.** A blocked edit never calls `registerFailure`. The outcome is the same every
  time and is not a guessing attempt, and retries from a misbehaving client must not fill the
  counter with noise.
- **Not hidden by a lockout.** A default user that is currently locked out still gets `409`, not
  `423`, because nothing about the outcome would change after the cool-off.
- **No reset either.** A blocked edit leaves an existing lockout row untouched.

### `POST /admin/users/:id/edit.json` (`AdminService.editUser`)

1. `assertAnyFieldPresent` → `400` (unchanged).
2. Load the target user → `404` if missing (unchanged).
3. **Default-user block** → `409 DEFAULT_USER_MANAGED`.
4. Username/email availability → `409` (unchanged).
5. Apply, revoke sessions on a password change (unchanged).

The admin endpoint has no abuse guard and no current-password check, so the only constraint is that
the block runs before any write.

## Password recovery and reset

A reset changes a managed field just like `newPassword`. Without a block, the new password would
work until the next boot and then be silently reverted, and whoever controls the configured email
could take over the default user (possibly an admin) until then.

While `isEnabled()` is true:

| Endpoint | Default-user behavior |
|---|---|
| `POST /auth/recover.json` (public) | Unchanged response: `200 { sent: true }`, exactly as for an unknown email. No recovery token is created and no email is sent. Answering `409` would reveal which email belongs to the environment-managed user. |
| `POST /auth/reset-password.json` (public, token + new password) | The token is validated first, with its existing errors unchanged. A valid token whose user is the default user → `409 DEFAULT_USER_MANAGED`, with no write (the password is unchanged and the token is not consumed; it simply expires). This covers tokens issued before the feature was enabled. A holder of a valid token learns nothing new from the `409`. |
| `POST /admin/users/:id/recovery-link.json` | After the existing `404` → `409 DEFAULT_USER_MANAGED`. No token is created. |
| `POST /admin/users/:id/send-recovery-email.json` | After the existing `404` → `409 DEFAULT_USER_MANAGED`. No token is created and no email is sent. |

The `409` responses use the same code, message and body as the edit endpoints. None of these
endpoints has an abuse guard, so there is no counter interaction.

## Edge cases

- **Configured username changed between boots.** The next boot creates (or matches) a user with the
  new username, and that row becomes the default user. The previous one becomes an ordinary,
  editable user, consistent with [boot-sync.md](boot-sync.md#disabled).
- **Feature turned off, then on again.** While off, the default user is editable like any other.
  Edits made then are overwritten by the next enabled boot (boot sync is the source of truth). This
  is intended.
- **The default user is an admin editing itself through the admin endpoint.** Blocked like any
  other caller. The block depends on the target, never on the caller.
- **Another user claims the default user's username or email.** Already rejected by the existing
  uniqueness checks (`USERNAME_TAKEN` / `EMAIL_TAKEN`). This contract adds nothing.
- **Recovery token issued before the feature was enabled.** Covered by the `reset-password.json`
  row above (`409`, the token is not consumed).

## Compatibility

- **Feature off (the default): no behavior change.** Every endpoint answers exactly as today. All
  existing tests stay valid unchanged.
- **Additive API change.** `DEFAULT_USER_MANAGED` is a new code. The body shape, the filter and
  every existing code and status stay the same.
- **No reordering of existing checks.** Because the block compares ids, `updateAccount` and
  `editUser` only gain one step; their current steps keep their order and their responses.
- **Frontend works unchanged.** `MyAccountController` and `AdminUserEditController` surface any
  non-`403` error's `error.message` as the submit error, so the `409` shows "This user is managed
  by environment configuration and cannot be edited" with no frontend change. (`409` also avoids
  the admin form's `403` redirect-home handling, which would have misled the admin.) The
  reset-password page is expected to surface the message the same way; #369 confirms this while
  implementing.
- **Existing data.** No migration. A default user created by an earlier enabled boot that is now
  disabled stays editable (see [Edge cases](#edge-cases)).

## Future write paths

- **No endpoint edits `is_admin` today.** `UserFieldChangesDto` has no admin-flag field, so there is
  nothing to block for it now. Only boot sync writes it.
- **General rule:** any future endpoint or flow that writes a managed field of the default user
  (`username`, `email`, the password, or the admin flag) must apply the same block, returning
  `409 DEFAULT_USER_MANAGED` with the same message and body, before any write, while
  `isEnabled()` is true. The only exception is a public endpoint that must not reveal which user is
  the default one, which must follow the `recover.json` precedent (answer as for an unknown user,
  do nothing).

## Required tests

- With the feature enabled, `PATCH /auth/account.json` on the default user with any managed field
  (`username`, `email`, `newPassword`) returns `409 DEFAULT_USER_MANAGED`, with the documented
  message and standard body (no `error.details`), and changes nothing.
- The same applies when the managed field's value equals the stored one.
- A blocked self-edit never checks `currentPassword` (a wrong one still gets `409`), never calls
  `registerFailure` and leaves an existing lockout row untouched. A locked-out default user gets
  `409`, not `423`.
- A request with no field present still gets `400`, before the block.
- `POST /admin/users/:id/edit.json` on the default user returns `409 DEFAULT_USER_MANAGED`; an
  unknown id still returns `404`. The default user editing itself as an admin is blocked too.
- `POST /auth/recover.json` for the default user's email returns `200 { sent: true }`, creates no
  token and sends no email.
- `POST /auth/reset-password.json` with a valid token for the default user returns `409`, leaves the
  password unchanged and does not consume the token. Invalid or expired tokens keep their existing
  errors.
- `POST /admin/users/:id/recovery-link.json` and `send-recovery-email.json` for the default user
  return `409`, create no token and send no email.
- Identity is by id: a stored username differing only in case or accents from the configured one is
  still blocked.
- Other users stay editable and recoverable while the feature is enabled.
- With the feature disabled, every endpoint behaves exactly as today, including for a default user
  created by an earlier enabled boot, which becomes editable again.
