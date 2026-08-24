# Migrate backend tests from Jasmine to Jest

Switch the backend's test runner to Jest (NestJS's native/idiomatic choice — settled during
issue discussion; Jest's `describe`/`it`/`expect` API is close enough to Jasmine's that porting
existing specs is mostly mechanical) and write the module/e2e/lazy-loading coverage the issue
requires.

- Replace `jasmine`/`c8` devDependencies in `backend/package.json` with `jest`, `ts-jest` (or
  `@nestjs/testing`'s recommended SWC/Jest setup), `@types/jest`, `supertest` (for e2e HTTP
  assertions), `@nestjs/testing`.
- Keep the `coverage` and `lint` script **names** unchanged in `backend/package.json` (per this
  plan's shared contract with `infra`) — only their implementation changes:
  `"coverage": "jest --coverage"` (or equivalent), config via `jest.config.ts`/`package.json`'s
  `jest` key.
- Port `backend/spec/accounts/Authenticator_spec.js` and `Registrar_spec.js` into
  `backend/src/auth/tests/auth.service.spec.ts` (unit) — same assertions, Jest syntax, injecting
  mocked TypeORM repositories instead of Sequelize model doubles.
- Add `backend/src/auth/tests/auth.controller.e2e-spec.ts` — e2e coverage via
  `@nestjs/testing`'s `TestingModule` + `supertest`, covering: login flow, refresh token
  rotation, token expiry, httpOnly cookie configuration, and the JWT guard rejecting invalid
  tokens (per the issue's "Auth-specific" testing bullet).
- Add a lazy-loading verification test exercising
  [Step 03](03-lazy-module-loader.md)'s `LazyModuleLoader` wrapper — assert the throwaway test
  module is not instantiated until its first request.
- Remove `backend/spec/` once every existing spec has a ported Jest equivalent, and remove `c8`
  from `backend/package.json`.

## Files to Change

- `backend/package.json` — swap `jasmine`/`c8` deps for `jest`/`ts-jest`/`supertest`, keep
  `coverage`/`lint` script names
- `backend/jest.config.ts` (or `package.json`'s `jest` key) — new
- `backend/src/auth/tests/auth.service.spec.ts` — new, ported from `Authenticator_spec.js` +
  `Registrar_spec.js`
- `backend/src/auth/tests/auth.controller.e2e-spec.ts` — new
- `backend/src/core/tests/lazy-module-loader.spec.ts` — new
- `backend/spec/` — removed once ported

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`) — same
  command, now runs Jest instead of `c8 jasmine`.
