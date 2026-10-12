# Issue: Backend: DefaultUserConfig for the default-user environment variables

## Description

Part of #366. Implements `docs/agents/specs/default-user/configuration.md` and the configuration-side rules of `security.md`. While the spec is active, it is the source of truth; this issue only summarizes it, plus four clarifications (below) that this issue adds to the spec.

Add a `DefaultUserConfig` class in the backend auth module that is the **only** reader of the `KERGHAN_DEFAULT_USER_*` environment variables. Boot sync (#369), automatic login (#370) and edit blocking call its methods and never read `ConfigService` or `process.env` for these variables. It follows the precedent of `buildMailConfig` in `backend/src/mail/mail.config.ts`: built once at boot, pure apart from the `ConfigService` reads, and fails fast on invalid configuration.

## Problem

The default-user feature is driven by eight environment variables with rules that interact: always-authenticated implies enabled, required values only when enabled, a loopback-only default allowlist, and a production guard. If each consumer read and interpreted them on its own, the rules would drift and a misconfiguration could surface only at request time, instead of at boot.

## Expected Behavior

### Methods

- `isEnabled()`: `true` when `ENABLED` **or** `ALWAYS_AUTHENTICATED` is on.
- `isAlwaysAuthenticated()`
- `username()`, `email()`, `password()`, `isAdmin()` (`isAdmin()` is `false` when `ADMIN` is unset).
- `isIpAllowed(ip)`: whether a resolved client IP is in `ALLOWED_IPS` (comma-separated IPs and/or CIDRs, IPv4 and IPv6). Empty or unset means loopback only (`127.0.0.1`, `::1`).

### Validation at boot

When `isEnabled()` is true, the backend fails to boot, with an error naming the offending variable (or the offending allowlist entry), when:

- `USERNAME`, `EMAIL` or `PASSWORD` is missing or empty;
- `EMAIL` is not a valid email;
- `PASSWORD` fails the registration password rules;
- `ALLOWED_IPS` contains a malformed IP or CIDR;
- `STAGE=production`, `isAlwaysAuthenticated()` is true, and `ALLOW_IN_PRODUCTION` is not `true`.

All problems found are reported together in a single error. Only the exact string `true` turns a flag on (`TRUE`, `1`, `yes`, empty and unset are off).

The password never appears in any error message or log line.

### Clarifications added by this issue

These are decided here and written into `configuration.md` in the same PR, following `docs/agents/specs.md`:

1. **Nothing is validated when disabled.** When `isEnabled()` is false, no check runs at all, including `ALLOWED_IPS`. A stale or malformed allowlist never blocks a deployment that does not use the feature. (The production guard cannot trigger then, since always-authenticated implies enabled.)
2. **IPv4-mapped IPv6 addresses are normalized.** `isIpAllowed` matches `::ffff:a.b.c.d` as `a.b.c.d`, so the loopback-only default and IPv4 CIDRs work however the socket reports the address. Example: `::ffff:127.0.0.1` is allowed by the default allowlist.
3. **Whitespace.** `USERNAME`, `EMAIL` and each `ALLOWED_IPS` entry are trimmed (empty entries from stray commas are ignored). `PASSWORD` is used verbatim. Flags are compared to `true` exactly, with no trimming.
4. **Shared password rule.** The registration minimum length moves to a shared constant (e.g. `PASSWORD_MIN_LENGTH = 8`) in the auth module, used by both `RegisterDto`'s `@MinLength` and `DefaultUserConfig`, so the two cannot drift.

## Solution

- Add `backend/src/auth/default-user.config.ts` with the `DefaultUserConfig` class. It is constructed from `ConfigService` and validates when built, collecting every problem into a single error, in the style of `buildMailConfig`.
- Register it in `auth.module.ts` as a factory provider (`useFactory` + `inject: [ConfigService]`), so that an invalid configuration fails at boot.
- Email validation uses `class-validator`'s `isEmail` (the rule behind `RegisterDto`'s `@IsEmail`). Password validation uses the shared `PASSWORD_MIN_LENGTH` constant.
- IP and CIDR parsing uses `node:net` (`isIP`, `BlockList`); no new dependency.
- Update `docs/agents/specs/default-user/configuration.md` with the four clarifications and their required tests.
- Unit tests in `backend/src/auth/tests/` cover every item under "Required tests" in `configuration.md`, the configuration-side items of `security.md` (production guard, password absent from errors), and the clarifications:
  - with the feature disabled, a malformed `ALLOWED_IPS` and missing required values do not fail;
  - `::ffff:127.0.0.1` is allowed by the default allowlist, and IPv4-mapped addresses match IPv4 CIDRs;
  - surrounding whitespace is trimmed from username, email and allowlist entries but not from the password, and ` true` is not a flag value;
  - `RegisterDto` still enforces the same minimum length through the shared constant.

### Scope: out

- Using the config: boot sync (#369), automatic login and the boot warning (#370), standalone (#371, #372).
- Permanent docs (`environment-variables.md` and similar). The variables stay documented only in the spec until #373.

## Benefits

- One place that defines what each variable means, so later sub-issues build against methods instead of raw env reads.
- A misconfigured default user, or always-authenticated in production without opt-in, is caught at boot instead of at request time.
