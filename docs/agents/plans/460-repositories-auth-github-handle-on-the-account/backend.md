# Backend Plan: Repositories: Auth — GitHub handle on the account

Main plan: [plan.md](plan.md)

## Overview

Implement `docs/agents/specs/repos/model.md#github-handle` in `backend/src/auth/`, plus the decisions recorded in issue #460 (see its "Solution" section). The spec is the source of truth. If the code forces a divergence, update `docs/agents/specs/repos/model.md` (and `security.md` if affected) in the same PR, and list the divergence in the PR description.

## Context

- `PATCH /auth/account.json` lives in `AuthController#updateAccount` and delegates to `AccountService#updateAccount`. The current order is `assertAnyFieldPresent` → default-user block (`hasManagedField`) → lockout → load user → `currentPassword` and availability checks (counted by the abuse guard) → `UserUpdateService#applyUserUpdate` → guard reset → token revocation on a password change.
- `assertAnyFieldPresent` and `hasManagedField` (`assert-any-field-present.ts`) are shared with `AdminService#editUser`.
- `UserFieldChangesDto` is shared by `UpdateAccountDto` and `AdminUpdateUserDto`. The global `ValidationPipe` is `{ whitelist: true, transform: true }`: unknown fields are stripped, not rejected.
- `AuthController` already carries `@CachePolicy(CacheClass.Never)` at class level, and `cache-policy.coverage.spec.ts` already lists `AuthController`.
- Admin responses go through `AdminController#serializeUser` (an allowlist), so a new entity column does not leak to admins.
- The default-user boot sync (`DefaultUserService#update`/`#createOrUpdate`) sets explicit fields on a loaded entity and saves it, so it leaves `github_handle` as it is. Assert this in a test.
- `AuthModule` exports `[AuthService, SESSION_LOOKUP]`.

## Steps

- [01 — Column, entity and migration](backend/01-column-and-migration.md)
- [02 — Handle normalisation, validation and DTO](backend/02-normalisation-validation-dto.md)
- [03 — Account edit paths](backend/03-account-edit-paths.md)
- [04 — Read route and Auth export](backend/04-read-route-and-export.md)
- [05 — Tests, spec sync and README row](backend/05-tests-and-spec-sync.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`).
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`).

## Notes

- Keep files under the 300-line convention. `AccountService` is close to it, so put the handle-only path and the normalisation in small helpers or services rather than growing it.
- `POST /auth/account/mine.json` answers `201` (Nest's `POST` default), as the spec says. Do not add `@HttpCode(200)`.
- Out of scope: handle-change reconciliation (#463), the frontend (#465), and the permanent Auth docs (#452).
