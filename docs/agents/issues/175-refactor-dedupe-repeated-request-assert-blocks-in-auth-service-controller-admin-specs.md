# Issue: Refactor: dedupe repeated request/assert blocks in auth service/controller/admin specs

## Description
A set of backend specs each contain small repeated request/assert blocks that jscpd flags (8-18 lines each): mostly "do X" and "X also sets the `X-Skip-Cache` header" cases that redo the whole request, plus repeated setup blocks in unit specs.

## Problem
Line numbers below come from the original jscpd report and have drifted since #170 — re-run jscpd at implementation time to confirm the exact spots.

- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts`: the reset-password request is written out once to check the body (`{ reset: true }`) and again in a separate `it` to check `x-skip-cache`.
- `auth.controller.account.e2e-spec.ts`: the same `PATCH /auth/account.json` is written out twice (success case and `sets the X-Skip-Cache header`); a further block is also flagged against `auth.controller.guard.e2e-spec.ts` (login-cookie + request + expect boilerplate).
- `admin.controller.e2e-spec.ts`: each endpoint has a body-check `it` and a separate `sets the X-Skip-Cache header` `it` with an identical request (send-recovery-email, edit, and others).
- `auth.service.spec.ts`: the `beforeEach` mocking an expired refresh token (`findOneBy` → `{ ...activeToken, expiresAt: new Date(Date.now() - 1000) }`) is repeated in the `refresh` and `status` describes.
- `auth.controller.spec.ts`: the `configService` mock + `new AuthController(authService, configService)` construction is repeated across the cookie-maxAge and logoff specs.
- `backend/src/core/tests/logger.service.spec.ts` ↔ `request-logging.e2e-spec.ts`: the identical `consoleSpies` block (`jest.spyOn(console, …).mockImplementation(...)` for debug/info/warn/error) is duplicated across a unit spec and an e2e spec.

## Expected Behavior
Each repeated pair is folded into a local helper or a shared `beforeEach`, keeping every distinct behavior covered as its own `it`. In particular, the separate `sets the X-Skip-Cache header` tests stay as distinct, named tests — the request is issued once in a shared `beforeEach` of a `describe` and both the body test and the header test assert against its response.

## Solution
Go file by file, applying the pattern to **every** occurrence in the files named above (not only the single pair jscpd flagged — e.g. all skip-cache pairs in `admin.controller.e2e-spec.ts`, both in `auth.controller.recovery.e2e-spec.ts`):
- e2e specs: group the body test and the `sets the X-Skip-Cache header` test under a `describe` whose `beforeEach` issues the request and stores the response; keep each assertion in its own `it`. Tests that use a different request (e.g. 404 for an unknown id) stay outside that `describe`. Extract a local request function where several tests share it.
- `auth.service.spec.ts`: extract the expired-token mock into a small helper used by both describes.
- `auth.controller.spec.ts`: extract a `buildController(configService)` helper.
- Console spies: extract a shared helper (a `*.test-support.ts` file under `backend/src/core/tests/`, following the existing test-support naming) used by both the logger unit spec and the request-logging e2e spec.

Out of scope: specs outside the files named in this issue (e.g. `authorization-request.*` e2e specs), and moving skip-cache checks into `auth.controller.skip-cache.e2e-spec.ts`.

Do not remove coverage — only redundancy. All work is inside `backend/` (backend agent); run tests/lint through `docker-compose`.

## Benefits
Smaller, less repetitive specs that are easier to maintain, with no loss of coverage and the per-behavior test names (including the X-Skip-Cache ones) preserved. Note: because the request still runs once per test, this does not reduce HTTP round-trips or e2e runtime.
