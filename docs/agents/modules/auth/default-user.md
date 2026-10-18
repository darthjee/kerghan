# Auth: default user and automatic login

Part of the [Auth module](../auth.md). Defines the environment-configured default user and the
optional automatic login in `status.json`. Product decision: epic #366. Code:
`backend/src/auth/default-user.config.ts`, `default-user-allowlist.ts` and
`default-user.service.ts`.

## Overview

Given certain environment variables, Kerghan treats a configured user as authenticated without a
manual login:

- **Default user.** At boot, the backend creates a user from environment variables (username,
  email, password, admin flag), or synchronizes it if it already exists. The environment is the
  source of truth for that user, so the API refuses to edit the fields it manages.
- **Automatic login (optional).** A second flag makes a client with no valid session log in
  automatically as the default user. This happens only in `status.json`, which the frontend calls
  on load, and only for allowed client IPs. It issues real cookies and a real session, exactly as
  `login.json` does.

The feature is aimed mainly at the [standalone distribution](../../standalone.md), where a fresh
installation opens already logged in. It is also available online, behind an IP allowlist and a
production guard. It is off by default: with no `KERGHAN_DEFAULT_USER_*` variable set, every
endpoint behaves as if the feature did not exist.

## Configuration

The variables and their defaults are listed in
[environment-variables.md](../../environment-variables.md#1-backend-application-runtime) (the
`KERGHAN_DEFAULT_USER_*` rows), with the accepted flag values and the boot validation rules in
[Default user: values and boot validation](../../environment-variables.md#default-user-values-and-boot-validation).

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
  [User approval](user-approval.md#default-user)), so a default user denied directly in the DB
  is approved again on the next boot.
- It records the **id** of the row it created or matched (see
  [Identifying the default user](#identifying-the-default-user)) and logs
  `default user synchronized` with that id.

`auth_users.username` and `auth_users.email` are both unique; the lookup by username uses the
column's MySQL collation.

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

## Edit blocking

While `isEnabled()` is true, the default user's managed fields must not change through the API.
Without the block, a rename would make the next boot create a second user (probably colliding on
email), and email and password edits would be silently reverted at boot.

The block lives in the services, not in the controllers. While `isEnabled()` is false, nothing is
blocked.

### What is blocked

- **Managed fields:** `username`, `email`, `newPassword` (the fields of `UserFieldChangesDto`;
  `hasManagedField` in `assert-any-field-present.ts`), plus the admin flag if an endpoint ever
  edits it. This list is the single source of truth for editable fields. The approval `status`
  is managed too: boot sync forces it to `approved`, and `POST /admin/users/:id/deny.json`
  answers `409 DEFAULT_USER_MANAGED` for the default user (after the `404` for an unknown id,
  before `CANNOT_DENY_SELF`); see [User approval → Default user](user-approval.md#default-user).
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
[Auth routes](../../backend/routes/auth.md#default-user-409-default_user_managed).

**Why no `error.details`:** every editable field is managed today, so listing them adds nothing.
A frontend that wants to disable the inputs needs to know before submitting, which is a
read-side indicator (out of scope).

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
- Today all editable fields are managed, so in practice every edit reaching the default user is
  rejected.
- A request with no field present is still rejected earlier by `assertAnyFieldPresent` (`400`).
- **Presence, not value:** a managed field is blocked even when its value equals the stored one.
  **Why:** the response never confirms a stored value (a `409` vs `200` difference would, and for
  `newPassword` it would reveal whether a guess is the managed password), and no `bcrypt.compare`
  is needed to decide.

### Order of checks

The block runs early and never counts as a failed attempt.

`PATCH /auth/account.json` (`AccountService.updateAccount`):

1. `assertAnyFieldPresent` → `400`.
2. **Default-user block** → `409 DEFAULT_USER_MANAGED`. It compares the session's `userId` with
   the default user's id, so no user load is needed.
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

## Automatic login

When `isAlwaysAuthenticated()` is true, `POST /auth/status.json` logs the caller in as the default
user (`AuthService#status` → `DefaultUserService#autoLogin`) when both hold:

- **There is no valid session.** `status.json` decides this by the `refresh_token` cookie alone,
  as always: missing, unknown, expired or revoked means no session. It never reads the access
  token. A valid refresh cookie wins and follows the normal flow, whoever its user is (for
  example after an explicit login as another user).
- **The client IP is allowed.** The IP is resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS`
  handling (`extractClientRequestInfo` in `backend/src/core/client-request.ts`, the same one the
  device-authorization endpoint uses) and checked with `isIpAllowed`. An empty IP is never
  allowed.

It also needs boot sync to have recorded an id and the row to still exist; otherwise the caller
gets the normal unauthenticated answer.

The session is minted through `TokenService#issueTokens`, the same path `login.json` uses, with
`keepSignedIn: false` (regular refresh TTL), and the controller sets the same cookies through
`setSessionCookies`. From then on, it is a normal session: refresh, the session list, revocation,
`AdminGuard` and the frontend all work unchanged. Each browser or client without cookies gets its
own session. The wire contract is in
[Auth routes](../../backend/routes/auth.md#post-authstatusjson).

What stays unchanged:

- **`JwtGuard` and every other protected endpoint.** A request without a cookie still gets `401`.
  An expired access token mid-session is renewed through the normal `refresh.json` flow.
- **Logout** clears the session as usual; the next `status.json` logs in as the default user
  again.
- **`status.json` stays passive** on every automatic-login path: it never revokes anything
  there. Its only write is revoking a denied user's still-active token (`admin_denied`), see
  [Auth routes](../../backend/routes/auth.md#post-authstatusjson).

### Boot warning

While automatic login is on, every boot logs a warning,
`AUTOMATIC LOGIN IS ON: status.json logs callers in as the default user`, with the default
username and the effective IP allowlist. It never includes the password.

### Turning it off

Sessions already created by automatic login stay valid until they expire. They are not revoked at
boot.

### Why only `status.json`

- **Rejected: bypassing authentication in the guard** (filling `request.user` without issuing
  tokens). The session list, revocation, logout and the frontend's `status.json` would all need
  special handling.
- **Rejected: automatic login in `JwtGuard`.** Any protected request without a cookie (a `curl`
  loop, a monitor, a crawler) would create a new refresh-token row every time, and the table would
  grow without limit (session flooding). It would also turn the guard from a token verifier into
  a token issuer that writes cookies.
- The frontend always calls `status.json` first, so this gives one session per browser and covers
  the full browser experience. API clients without a cookie still get `401`.

## Security

### IP allowlist

`KERGHAN_DEFAULT_USER_ALLOWED_IPS` decides who can receive the automatic login.

- A request from outside the list gets the normal unauthenticated response, with no error.
- Empty or unset means loopback only (`127.0.0.1`, `::1`): opening automatic login to remote
  clients is always a deliberate choice.
- IPv4-mapped IPv6 client addresses (`::ffff:a.b.c.d`, as Node reports IPv4 clients on a
  dual-stack socket) are matched as their IPv4 form.
- A malformed IP or CIDR fails at boot, naming the bad entry.
- The client IP is resolved with `KERGHAN_TRUSTED_PROXY_HOPS`, so a forged `X-Forwarded-For`
  entry beyond the trusted hops cannot bypass the allowlist. An invalid value (not a non-negative
  integer) falls back to the default (`1`) instead of trusting the leftmost, client-supplied
  entry. With `0` and an `X-Forwarded-For` header present, no IP is resolved, so automatic login
  stays off (fails closed).
- **Deployment invariant:** that guarantee only holds when every request reaches the backend
  through Tent, which overwrites `X-Forwarded-For` (`SetClientIpMiddleware`). The backend does not
  check that the socket peer is Tent, so anyone who can reach the backend port directly can forge
  the resolved IP (for example `X-Forwarded-For: 127.0.0.1`). While automatic login is on, never
  expose the backend port beyond loopback or the internal Docker network. The dev
  `docker-compose.yml` binds it to `127.0.0.1`. Checking the socket peer against a configured
  trusted-proxy address is a possible future hardening, not decided.
- This lets a production deployment turn on automatic login only for known networks (an office
  or VPN range) while everyone else uses the normal login.

### Production guard

When `STAGE=production` and `isAlwaysAuthenticated()` is true, the backend **refuses to boot**
unless `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION=true` is also set. The check lives in
`DefaultUserConfig`. `ENABLED` alone (no automatic login) boots in production without it. The
guard keys on `STAGE`, not `NODE_ENV`; the standalone stack does not set `STAGE`.

### Admin access

With `KERGHAN_DEFAULT_USER_ADMIN=true`, **whoever receives the automatic login is an admin**. That
is intended for standalone. An online deployment can avoid it with
`KERGHAN_DEFAULT_USER_ADMIN=false` (the default).

### Credentials

- The default user's password is never logged: not in boot validation errors, not in the boot
  warning, not in the collision error.
- The standalone client generates it with `openssl rand -hex 24` (48 random hex characters); see
  [standalone.md](../../standalone.md#secrets).

### Standalone exposure

While automatic login is on, the standalone client publishes its port on `127.0.0.1` by default
instead of every interface; `bind` is the real exposure guard there, not the allowlist. See
[standalone.md](../../standalone.md#config-format) and its
[Effective client IP](../../standalone.md#effective-client-ip) section.

### Sessions after turning it off

Sessions created by automatic login stay valid until they expire; turning the feature off does not
revoke them.

## Out of scope

- **A frontend indicator.** With login happening only in `status.json`, the frontend simply sees a
  logged-in user. Hiding logout or showing an "automatic login" indicator is a separate issue.
- **More than one default user.**
- **Removing a previously created default user** when the flag is turned off. It stays untouched.
- **Changing the demo-user seed migration.**
- **Turning the feature on in any production deployment** (for example Render).

## Testing

- `backend/src/auth/tests/default-user.config.spec.ts` — `DefaultUserConfig`: flags, trimming,
  boot validation, the allowlist and the production guard.
- `backend/src/auth/tests/default-user.service.spec.ts` — boot sync, the id-based identity,
  `autoLogin` and the boot warning.
- `backend/src/auth/tests/auth.controller.default-user.e2e-spec.ts` and
  `admin.controller.default-user.e2e-spec.ts` — the `409` on the edit, recovery and reset routes,
  identity by id, and the feature turned off after an enabled boot.
- `backend/src/auth/tests/auth.controller.auto-login.e2e-spec.ts` — automatic login on
  `status.json` (cookies, session, allowlist, caching headers).
- `backend/src/auth/tests/support/default-user-e2e.ts` — shared e2e setup.
- The service specs of `AccountService`, `AdminService`, `PasswordResetService` and `AuthService`
  also cover their default-user branches.
- Standalone: `standalone/test/auto_login.bats`, `bind.bats`, `update_env.bats` and
  `upgrade.bats`.
