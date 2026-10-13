# Configuration

Implemented by #368. Part of the [default-user specs](README.md).

## Variables

| Variable | Meaning | Default | Required when |
|---|---|---|---|
| `KERGHAN_DEFAULT_USER_ENABLED` | When `true`, create or synchronize the default user at boot ([boot-sync.md](boot-sync.md)). | off | — |
| `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` | When `true`, clients with no valid session are logged in automatically as the default user ([automatic-login.md](automatic-login.md)). Implies `ENABLED`. | off | — |
| `KERGHAN_DEFAULT_USER_USERNAME` | The default user's username. | none | enabled |
| `KERGHAN_DEFAULT_USER_EMAIL` | The default user's email. Must be a valid email (users always have an email). | none | enabled |
| `KERGHAN_DEFAULT_USER_PASSWORD` | The default user's password. Must pass the same validation rules as registration. | none | enabled |
| `KERGHAN_DEFAULT_USER_ADMIN` | When `true`, the default user is an admin (`is_admin = true`); otherwise a regular user. | `false` | — |
| `KERGHAN_DEFAULT_USER_ALLOWED_IPS` | Comma-separated IPs and/or CIDR ranges allowed to receive the automatic login, e.g. `127.0.0.1,10.0.0.0/8,203.0.113.7`. Empty or unset means loopback only (`127.0.0.1`, `::1`). See [security.md](security.md#ip-allowlist). | loopback only | — |
| `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION` | Must be `true` for always-authenticated to boot when `STAGE=production`. See [security.md](security.md#production-guard). | off | always-authenticated with `STAGE=production` |

"Enabled" means `DefaultUserConfig.isEnabled()` is true (see below).

Example (placeholder values only):

```bash
KERGHAN_DEFAULT_USER_ENABLED=true
KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_DEFAULT_USER_USERNAME=admin
KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local
KERGHAN_DEFAULT_USER_PASSWORD=example-password
KERGHAN_DEFAULT_USER_ADMIN=false
KERGHAN_DEFAULT_USER_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

## Flag values

A flag counts as on only when its value is exactly the string `true`, consistent with
`KERGHAN_EMAILS_ENABLED`. Any other value (`TRUE`, `1`, `yes`, empty, unset) is off. Flags are compared untrimmed, so
` true` or `true ` is off too.

## Value handling

- `USERNAME` and `EMAIL` are trimmed of surrounding whitespace before validation and use.
- `ALLOWED_IPS` is split on `,`; each entry is trimmed and empty entries (stray commas) are ignored.
- `PASSWORD` is used verbatim: surrounding whitespace is part of the password.

## `DefaultUserConfig`

All environment-variable handling for this feature lives in a single configuration class,
`DefaultUserConfig`, in the auth module.

- It is built once at boot.
- It is the **only** reader of the `KERGHAN_DEFAULT_USER_*` variables. The rest of the code (boot
  sync, automatic login, edit blocking) calls its methods and never reads `ConfigService` or
  `process.env` for these variables directly.
- It follows the precedent of `buildMailConfig` in `backend/src/mail/mail.config.ts`, which
  resolves and validates the `KERGHAN_EMAIL_*` variables in one place.

Methods:

| Method | Returns |
|---|---|
| `isEnabled()` | `true` when `ENABLED` **or** `ALWAYS_AUTHENTICATED` is on. Always-authenticated implies enabled; this logic lives here, not scattered across callers. |
| `isAlwaysAuthenticated()` | Whether clients with no valid session are logged in automatically. |
| `username()`, `email()`, `password()`, `isAdmin()` | The configured values. `isAdmin()` is `false` when `ADMIN` is unset. |
| IP-allowlist check (e.g. `isIpAllowed(ip)`) | Whether a resolved client IP is in the allowlist (loopback only when the list is empty or unset). IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are normalized to their IPv4 form (`a.b.c.d`) before matching. Anything that is not a valid IP is not allowed. |

## Validation at boot

`DefaultUserConfig` fails fast at boot, with an error naming the offending variable (or, for the
allowlist, the offending entry), when:

- `isEnabled()` is true and `USERNAME`, `EMAIL` or `PASSWORD` is missing or empty;
- `isEnabled()` is true and `EMAIL` is not a valid email;
- `isEnabled()` is true and `PASSWORD` fails registration's password rules — the minimum length
  is the shared `PASSWORD_MIN_LENGTH` constant (`backend/src/auth/password-rules.ts`) that
  `RegisterDto` also uses, so the two rules cannot drift;
- `isEnabled()` is true and `ALLOWED_IPS` contains a malformed IP or CIDR (a valid form is a bare
  IP, or `ip/prefix` with an integer prefix of 0–32 for IPv4 or 0–128 for IPv6);
- `STAGE=production`, `isAlwaysAuthenticated()` is true, and `ALLOW_IN_PRODUCTION` is not `true`
  (the [production guard](security.md#production-guard)).

When `isEnabled()` is false, no check runs at all — including `ALLOWED_IPS` and the production
guard — and nothing else in the feature runs at boot.

All problems found are reported together in a single error.

The password is never logged, including in validation errors.

## Required tests

- `isEnabled()` for each combination of `ENABLED` and `ALWAYS_AUTHENTICATED` (always-authenticated
  alone makes it true).
- Only the exact string `true` turns a flag on (`TRUE`, `1`, `yes`, ` true`, empty and unset are
  off).
- `isAdmin()` defaults to `false` when `ADMIN` is unset.
- Each missing or empty required value fails at boot with an error naming the variable, only when
  enabled; nothing is required when disabled.
- Several problems at once are all named in one error.
- An invalid email and a password failing registration's rules each fail at boot; a password of
  exactly `PASSWORD_MIN_LENGTH` passes, and `RegisterDto` enforces the same constant.
- A malformed IP or CIDR in `ALLOWED_IPS` fails at boot, naming the bad entry.
- When disabled, missing values and a malformed `ALLOWED_IPS` do not fail at boot.
- `USERNAME`, `EMAIL` and allowlist entries are trimmed and stray commas ignored; `PASSWORD` keeps
  surrounding whitespace.
- An empty or unset `ALLOWED_IPS` allows only `127.0.0.1` and `::1`.
- Single IPs and CIDR ranges (IPv4 and IPv6) are matched correctly by the allowlist check; a
  non-IP input is not allowed.
- IPv4-mapped IPv6 addresses match as IPv4: `::ffff:127.0.0.1` is allowed by the default list, and
  `::ffff:10.1.2.3` matches `10.0.0.0/8`.
- The production guard: `STAGE=production` with always-authenticated fails without
  `ALLOW_IN_PRODUCTION=true` and boots with it; `ENABLED` alone in production boots without it.
- No error message or log line contains the password.
