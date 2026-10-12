# Plan: Specs: default user feature definition

Issue: [367-specs-default-user-feature-definition.md](../../issues/367-specs-default-user-feature-definition.md)

## Overview

Documentation only. Create the temporary feature specs folder `docs/agents/specs/default-user/` for Epic #366, following the lifecycle and conventions of the specs hub (`docs/agents/specs.md`), and register it under "Active specs". The specs transcribe every decision recorded in #366. They introduce no new decisions: the two undecided API contracts become placeholders that point to #374 and #375. Each file ends with "Required tests".

## Context

- Epic #366 holds the decisions: the `KERGHAN_DEFAULT_USER_*` variables, the `DefaultUserConfig` class, boot-time sync, automatic login only in `status.json`, the IP allowlist, the production guard, the standalone wiring and the `kerghan.env` update command.
- Precedent: #337 wrote `docs/agents/specs/standalone/`, removed by #348 (`git show 782a47b`). Follow its shape:
  - a `README.md` with "Overview and purpose", "Product decision", "Scope" (in and out), "Sub-issues" and "Index";
  - one file per concern, each ending with "Required tests".
- File → sub-issue mapping: `configuration.md` → #368, `boot-sync.md` → #369 (+ #374), `automatic-login.md` → #370 (+ #375), `security.md` → #368/#370/#371, `standalone.md` → #371 and #372. #373 folds everything into the permanent docs and deletes the folder.
- The specs name existing code only to point at conventions to follow, and describe decisions, not code:
  - `backend/src/mail/mail.config.ts` (`buildMailConfig`)
  - `backend/src/core/jwt.guard.ts`
  - `backend/src/auth/auth.controller.ts` (`status.json`, `login.json`)
  - `KERGHAN_TRUSTED_PROXY_HOPS` in `authorization-request.controller.ts`
  - `ADMIN_PASSWORD_CHANGE` in `refresh-token.entity.ts`
  - `standalone/bin/kerghan` (`ensure_env_file`, `-p "$port:80"`)
  - `standalone/vault/docker-compose.yml`

## Steps

- [01 — README and hub registration](plan/01-readme-and-hub.md)
- [02 — configuration.md](plan/02-configuration.md)
- [03 — boot-sync.md](plan/03-boot-sync.md)
- [04 — automatic-login.md](plan/04-automatic-login.md)
- [05 — security.md](plan/05-security.md)
- [06 — standalone.md](plan/06-standalone.md)

## Notes

- **No code changes, and no permanent docs touched** (`environment-variables.md`, `standalone.md`, `product.md`, `modules/`). The temporary duplication is intended until #373.
- **No credential-like values in examples.** Use `<generated>` or `example-password`.
- **Placeholders** for #374 and #375 must read "to be defined by #374 / #375; do not implement before then".
- **Open technical risk** (the effective client IP inside Docker-in-Docker / Tent): recorded as open and assigned to #371. Do not resolve it here.
- **CI:** no CI job lints `docs/`. Check by hand that every relative link between the spec files and the hub resolves.
