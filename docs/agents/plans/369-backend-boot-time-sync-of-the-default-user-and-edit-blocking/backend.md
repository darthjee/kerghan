# Backend Plan: Backend: boot-time sync of the default user and edit blocking

Main plan: [plan.md](plan.md)

## Overview

Implement boot sync of the default user and the edit-blocking contract entirely inside `backend/src/auth`. A new `DefaultUserService` owns both the boot sync and the default-user identity (`isDefaultUser` / `assertNotDefaultUser`). The existing services call it at the exact points defined in `edit-blocking.md`'s "Order of checks". Controllers stay unchanged.

## Context

- `DefaultUserConfig` (#368, `backend/src/auth/default-user.config.ts`) is a validated, injectable provider exposing `isEnabled()`, `username()`, `email()`, `password()` and `isAdmin()`.
- Specs: `docs/agents/specs/default-user/boot-sync.md` (boot behavior + required tests) and `docs/agents/specs/default-user/edit-blocking.md` (the full API contract + required tests). They are the source of truth; this plan makes no API decision of its own.
- `auth_users.username` / `email` are unique, with MySQL's default case/accent-insensitive collation, hence identity by **id**.
- Migrations run separately (`synchronize: false`, `migration:run` script), so the table exists before `onApplicationBootstrap`.
- Precedents: `ER_DUP_ENTRY` detection in `account-edit-abuse-guard.service.ts` / `integration-store.service.ts`, `ConflictException({ code, message })` in `auth.service.ts`, `TokenService#revokeUserTokens`.

## Steps

- [01 — DefaultUserService: boot sync and default-user identity](backend/01-default-user-service.md)
- [02 — Block edits in AccountService and AdminService](backend/02-block-account-and-admin-edits.md)
- [03 — Block password recovery and reset](backend/03-block-recovery-and-reset.md)
- [04 — End-to-end coverage](backend/04-e2e-coverage.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Never run `yarn`/`node` on the host; always go through `docker-compose` (CLAUDE.md).
- Keep files within the project's ~300-line convention. `DefaultUserService` should stay small; split the boot-sync helper into its own file if it grows.
- Every new public method gets a JSDoc block, matching the surrounding services.
- `edit-blocking.md` says "#369 owns where the id is held". After implementation, update that spec line (and `boot-sync.md`'s matching sentence) to name `DefaultUserService`. This is a one-line docs touch-up.
- `edit-blocking.md` asks #369 to confirm that the frontend reset-password page surfaces a `409`'s `error.message`. Check this while implementing step 03 and note the result in the PR description. No frontend change is expected.
- Feature off (the default): every existing spec must keep passing unchanged.
