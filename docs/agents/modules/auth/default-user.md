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

## Pages

| Page | Read when |
|---|---|
| [Configuration and boot sync](default-user/configuration.md) | You need `DefaultUserConfig`, its methods, or how the user is created or synchronized at boot. |
| [Edit blocking](default-user/edit-blocking.md) | You touch an endpoint that writes the default user's managed fields (`409 DEFAULT_USER_MANAGED`). |
| [Automatic login](default-user/automatic-login.md) | You need how `status.json` logs a client in as the default user. |
| [Security](default-user/security.md) | You need the IP allowlist, the production guard, admin access or exposure rules. |

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
