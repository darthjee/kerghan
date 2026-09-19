# backend Plan: Refactor: dedupe X-Skip-Cache header handling across auth controllers

Main plan: [plan.md](plan.md)

## Overview
`auth.controller.ts`, `admin.controller.ts`, and `authorization-request.controller.ts` currently set the `X-Skip-Cache` response header with a hand-written `res.set(SKIP_CACHE_HEADER, 'true')` in 14 of their 17 route handlers (the other 3 — `login`, `refresh`, `register` — set it indirectly via `respondWithSession`'s own internal `res.set` call). `admin.controller.ts` additionally redeclares its own local `SKIP_CACHE_HEADER` constant instead of importing the one already exported from `auth-response.ts`. This plan introduces a `@SkipCache()` decorator backed by a `SkipCacheInterceptor`, registers it globally (metadata-gated, mirroring how `JwtGuard`/`AdminGuard` already work), and applies it at the controller level to all three controllers — which removes every manual `res.set(SKIP_CACHE_HEADER, ...)` call and, as a side effect, removes `admin.controller.ts`'s need for its own copy of the constant entirely.

## Steps

- [01 — Add the SkipCache decorator and interceptor](backend/01-add-skip-cache-decorator-and-interceptor.md)
- [02 — Register the interceptor globally](backend/02-register-interceptor-globally.md)
- [03 — Apply @SkipCache() to the three auth controllers](backend/03-apply-skip-cache-to-auth-controllers.md)
- [04 — Update the auth.controller unit spec](backend/04-update-auth-controller-spec.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- `auth-response.ts`'s `respondWithSession` helper (called by `login`, `refresh`, `register`, and `poll`'s approved branch) sets `X-Skip-Cache` directly on the same `res` object and is not itself a route handler, so it can't carry route-level `@SkipCache()` metadata. Leave it untouched: once its callers' controllers carry `@SkipCache()` at the class level, the interceptor sets the header too, making `respondWithSession`'s own `res.set` call redundant but harmless (setting the same header value twice is a no-op — last write wins, no duplicate-header issue). Removing it from `respondWithSession` is an optional follow-up, not required by this issue.
- 8 existing e2e specs assert the real HTTP response header via `supertest` against a booted `INestApplication` — these exercise Nest's actual interceptor pipeline and need no changes, since the observable behavior (header present with value `'true'`) is unchanged: `auth.controller.skip-cache.e2e-spec.ts`, `auth.controller.refresh-logout.e2e-spec.ts`, `auth.controller.recovery.e2e-spec.ts`, `auth.controller.account.e2e-spec.ts`, `authorization-request.controller.poll.e2e-spec.ts`, `authorization-request.controller.approver.e2e-spec.ts`, `authorization-request.controller.create.e2e-spec.ts`, `admin.controller.e2e-spec.ts`.
- Only `backend/src/auth/auth.controller.spec.ts` needs rework (see step 04) — it instantiates `AuthController` directly (`new AuthController(...)`) and asserts on a hand-rolled `res` mock, bypassing Nest's interceptor pipeline entirely, so those specific assertions would never see the interceptor-set header.
