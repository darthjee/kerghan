# Backend Plan: Backend: DefaultUserConfig for the default-user environment variables

Issue: [368-backend-defaultuserconfig-for-the-default-user-environment-variables.md](../../issues/368-backend-defaultuserconfig-for-the-default-user-environment-variables.md)

## Overview
Implement `docs/agents/specs/default-user/configuration.md` (and the configuration-side rules of `security.md`) as a `DefaultUserConfig` class, following the `buildMailConfig` precedent in `backend/src/mail/mail.config.ts`. Later sub-issues (#369 boot sync, #370 automatic login, edit blocking) inject it and call its methods. This issue does not consume it anywhere yet.

## Context
- The spec is the source of truth while active. This issue adds four clarifications that must be written into `configuration.md` in the same PR (`docs/agents/specs.md`, lifecycle rule 2):
  1. Nothing is validated when `isEnabled()` is false, including `ALLOWED_IPS`.
  2. `isIpAllowed` normalizes IPv4-mapped IPv6 (`::ffff:a.b.c.d` → `a.b.c.d`).
  3. `USERNAME`, `EMAIL` and each `ALLOWED_IPS` entry are trimmed (empty entries ignored). `PASSWORD` is verbatim. Flags must equal `'true'` exactly, with no trimming.
  4. The registration minimum password length becomes a shared constant used by `RegisterDto` and `DefaultUserConfig`.
- Registration rules today: `RegisterDto` uses `@IsEmail()` and `@MinLength(8)`.
- Client IP resolution (`KERGHAN_TRUSTED_PROXY_HOPS`, `backend/src/core/client-request.ts`) is #370's concern. `isIpAllowed` receives an already-resolved IP string.

## Steps

- [01 — Shared password rule](backend/01-shared-password-rule.md)
- [02 — DefaultUserConfig class](backend/02-default-user-config-class.md)
- [03 — Register the provider](backend/03-register-provider.md)
- [04 — Unit tests and spec update](backend/04-tests-and-spec-update.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Never run `yarn`/`node` on the host. Use `docker-compose` only.
- No new dependency: use `node:net` (`isIP`, `BlockList`) and `class-validator`'s function form (`isEmail`).
- The password must not appear in any thrown message or log line. Error messages name variables (and, for the allowlist, the bad entry), never values of `PASSWORD`.
- Keep functions small. The repo lints with `eslint-plugin-complexity`; split validation into helpers as `mail.config.ts` does.
- Permanent docs (`environment-variables.md` and similar) are out of scope until #373.
