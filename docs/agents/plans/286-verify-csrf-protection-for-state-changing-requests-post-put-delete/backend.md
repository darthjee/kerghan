# Backend Plan: Verify CSRF protection for state-changing requests (POST/PUT/DELETE)

Main plan: [plan.md](plan.md)

## Shared contracts

- Trusted origins come from `buildCorsOptions(configService)`. `true` means trust any origin; `undefined` means an empty list. Resolve them once in the guard's constructor. `buildCorsOptions` has already validated them at boot, so it won't throw here.
- Implement exactly the decision table in [plan.md](plan.md#shared-contracts). Only `POST`/`PUT`/`PATCH`/`DELETE` are checked.
- Reject with `ForbiddenException`. Register the guard as the first `APP_GUARD`, ahead of `JwtGuard`.

## Steps

- [01 — Add OriginGuard](backend/01-add-origin-guard.md)
- [02 — Register the guard globally and in the e2e test app](backend/02-register-guard.md)
- [03 — Add e2e coverage for forged and legitimate requests](backend/03-e2e-coverage.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`). Use the actual test service name from `docker-compose.yml`, and never run yarn on the host.
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Existing e2e specs send neither `Origin` nor `Sec-Fetch-Site` through supertest, so they fall into the "allow" row and should keep passing unchanged.
- Keep the guard free of business logic beyond the header decision, and put the pure decision function next to it so it can be unit-tested without Nest.
- Keep the existing `SameSite=Strict` cookie assertion in `auth.controller.login.e2e-spec.ts`. It is the first layer of protection and stays locked in.
