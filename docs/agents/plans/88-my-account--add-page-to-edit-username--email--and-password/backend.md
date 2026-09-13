# backend Plan: My Account: add page to edit username, email, and password

Main plan: [plan.md](plan.md)

## Shared contracts

Backend must produce `PATCH /auth/account.json`: authenticated, reads the user id from
`req.user!.sub`, sets `X-Skip-Cache: true`, request/response/error shapes exactly as specified in
[plan.md](plan.md)'s "Shared contracts" section. Frontend depends on this exact endpoint path,
request body, and response body.

## Steps

- [01 — Add UpdateAccountDto](backend/01-add-update-account-dto.md)
- [02 — Add self-exclusion duplicate check](backend/02-add-self-exclusion-duplicate-check.md)
- [03 — Add AccountService](backend/03-add-account-service.md)
- [04 — Wire module and controller endpoint](backend/04-wire-module-and-controller.md)
- [05 — Add backend tests](backend/05-add-backend-tests.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- `auth.service.ts` is already 258/300 lines — this is why the new logic goes into a dedicated
  `AccountService` rather than growing `AuthService` further, following the same precedent as
  the existing `PasswordResetService`/`TokenService` split.
- No `@CurrentUser()` decorator exists in this codebase; follow the established
  `@Req() req: Request` + `req.user!.sub` convention (see
  `backend/src/auth/authorization-request.controller.ts:100-107` and `:123-134` for the closest
  precedent — an authenticated endpoint that also re-checks a password).
- Password verification against `passwordDigest`: reuse whatever bcrypt-compare helper
  `AuthService`'s login flow already uses — do not reimplement hashing/compare logic.
