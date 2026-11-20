# Default user: configuration and boot sync

Part of the [Default user](../default-user.md) hub, itself part of the [Auth module](../../auth.md). How the environment variables are read and how the default user is created or synchronized at boot.

## Configuration

The variables and their defaults are listed in
[environment-variables.md](../../../environment-variables/backend.md) (the
`KERGHAN_DEFAULT_USER_*` rows), with the accepted flag values and the boot validation rules in
[Default user: values and boot validation](../../../environment-variables/backend-setup.md#default-user-values-and-boot-validation).

All of them are read by a single class, `DefaultUserConfig` (`default-user.config.ts`):

- It is built once at boot, by a factory provider in `auth.module.ts`
  (`DefaultUserConfig.fromConfigService`).
- It is the **only** reader of the `KERGHAN_DEFAULT_USER_*` variables (and reads `STAGE` for the
  production guard). Boot sync, automatic login and edit blocking call its methods and never read
  `ConfigService` or `process.env` for these variables.
- It follows the precedent of `buildMailConfig` (`backend/src/mail/mail.config.ts`), which
  resolves and validates the `KERGHAN_EMAIL_*` variables in one place.
- It validates on construction, only when the feature is enabled, and reports every problem in a
  single error. The password never appears in an error message.

| Method | Returns |
|---|---|
| `isEnabled()` | `true` when `ENABLED` **or** `ALWAYS_AUTHENTICATED` is on. Always-authenticated implies enabled; that rule lives here, not in the callers. |
| `isAlwaysAuthenticated()` | Whether clients with no valid session are logged in automatically. |
| `username()`, `email()`, `password()`, `isAdmin()` | The configured values (username and email trimmed, password verbatim). `isAdmin()` is `false` when `ADMIN` is unset. |
| `isIpAllowed(ip)` | Whether a resolved client IP is in the allowlist. IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are matched as their IPv4 form. Anything that is not a valid IP is not allowed. |
| `allowedIps()` | The effective allowlist: the configured entries, or `127.0.0.1` and `::1` when none are configured. Used by the boot warning. |

The allowlist parsing lives in `default-user-allowlist.ts` (Node's `BlockList`, used as an allow
set). IPv6 zone ids (`fe80::1%eth0`) are malformed entries.

## Boot sync

`DefaultUserService` (`default-user.service.ts`) runs in `onApplicationBootstrap`. When
`isEnabled()` is true:

- **No user with the configured username exists:** it creates one with the configured username,
  email, password and admin flag.
- **The user exists:** it overwrites the email, password and admin flag with the configured
  values.
- **Either way,** it sets `status` to `approved` (see
  [User approval](../user-approval.md#default-user)), so a default user denied directly in the DB
  is approved again on the next boot.
- It records the **id** of the row it created or matched (see
  [Identifying the default user](edit-blocking.md#identifying-the-default-user)) and logs
  `default user synchronized` with that id.

`auth_users.username` and `auth_users.email` are both unique; the lookup by username uses the
column's MySQL collation.

Boot sync never reads or writes `github_handle`: the handle is not managed, so turning the feature
off or on leaves it as it is.

### Password

- **No rehash on every boot.** The digest is updated only when the configured password differs
  from the stored one (checked with `bcrypt.compare`).
- **When the password actually changes,** the default user's existing sessions are revoked with
  `RevokedReason.ADMIN_PASSWORD_CHANGE`, consistent with admin password edits.

### Collisions and races

- **The configured email belongs to another user** (a different row): boot fails with an error
  naming the configured username and the owner's id.
- **Several instances boot at the same time:** if the insert hits the unique constraint (MySQL
  `ER_DUP_ENTRY`), the service treats it as "already exists", reloads the row and takes the update
  path.

### Disabled

When `isEnabled()` is false, nothing happens at boot and no id is held. A default user created by
an earlier boot stays in the database untouched, is no longer synchronized, and becomes an
ordinary editable user.

