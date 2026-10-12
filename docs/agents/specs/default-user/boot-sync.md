# Boot sync and edit blocking

Implemented by #369 (edit-blocking contract by #374). Part of the
[default-user specs](README.md).

`auth_users.username` and `auth_users.email` are both unique. A user can edit their username,
email and password through `account.json`, and admins can edit them through the admin endpoints.

## At boot

When `DefaultUserConfig.isEnabled()` is true ([configuration.md](configuration.md)):

- **No user with the configured username exists:** create it with the configured username, email,
  password and admin flag.
- **The user exists:** overwrite its email, password and admin flag with the configured values. The
  environment variables are always the source of truth for this user.

### Password

- **No rehash on every boot.** Update the password digest only when the configured password
  differs from the stored one (checked with `bcrypt.compare`).
- **The password actually changes:** revoke the default user's existing sessions, consistent with
  admin password edits (`RevokedReason.ADMIN_PASSWORD_CHANGE` in
  `backend/src/auth/entities/refresh-token.entity.ts`).

### Collisions and races

- **The configured email belongs to another user** (a different username): fail at boot with a
  clear error.
- **Several instances boot at the same time:** if creating the user hits the unique constraint,
  treat it as "already exists" and fall through to the update path.

### Disabled

When `isEnabled()` is false, nothing happens at boot. A default user created by an earlier boot
stays in the database untouched and is simply no longer synchronized.

## Edit blocking

While `isEnabled()` is true, the backend **blocks edits** of the default user's username, email,
password and admin flag, both through `account.json` and through the admin endpoints, with a clear
error such as "managed by environment configuration". Without this:

- a rename would make the next boot create a second user, probably colliding on email;
- email and password edits would be silently reverted at boot.

The blocking logic lives in the services, not in the controllers.

**HTTP status, error code and response body: to be defined by #374; do not implement before
then.**

## Required tests

- Boot creates the user with the configured username, email, password and admin flag when it does
  not exist.
- Boot overwrites email, password and admin flag when the user exists.
- An unchanged password is not rehashed and sessions are not revoked.
- A changed password is rehashed and the user's sessions are revoked.
- An email belonging to another user fails at boot with a clear error.
- A unique-constraint error on insert falls through to the update path.
- With `isEnabled()` false, nothing happens and an existing default user is untouched.
- While enabled, edits of username, email, password and admin flag are blocked through
  `account.json` and through each admin endpoint; other users stay editable, and the default user
  becomes editable again when the feature is disabled.
