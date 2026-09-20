# Backend Plan: Refactor: dedupe login()/createAuthorizationRequest() e2e helpers across authorization-request controller specs

Main plan: [plan.md](plan.md)

## Overview
`createAuthorizationRequest` is defined identically in three specs and `login` in two, each closing over the spec-local `app`. Both move into `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts`, which all three specs already import from, with `app` as an explicit first parameter. Test behavior must stay identical.

## Context
Test-only refactor under `backend/src/auth/tests/`; no production code changes. Note: `capApp` in `abuse-hardening.e2e-spec.ts` is only used for direct `request(capApp…)` calls — both helpers there always run against the main `app`, so every call site passes its spec's `app`.

## Implementation Steps

### Step 1 — Add the shared helpers
In `authorization-request.controller.e2e-test-support.ts`, add and export:

```ts
export async function createAuthorizationRequest(
  app: INestApplication,
  username = 'darthjee',
): Promise<{ uuid: string; pollToken: string }>
// POST /auth/authorization-requests.json with { username }, expect 201, return response.body

export async function login(app: INestApplication, username: string, password: string): Promise<string>
// POST /auth/login.json, return response.headers['set-cookie'][0].split(';')[0]
```

Bodies are copied verbatim from the existing local copies; `INestApplication` and `request` are already imported in the file. Add a short comment matching the surrounding style (e.g. as `buildTestApp`'s).

### Step 2 — Switch the three specs to the shared helpers
- `approver.e2e-spec.ts`: delete the local `createAuthorizationRequest` (lines ~16-23) and `login` (lines ~29-32); import both from the support file; update call sites to `createAuthorizationRequest(app, …)` / `login(app, …)`.
- `abuse-hardening.e2e-spec.ts`: delete the local `createAuthorizationRequest` (~18-25) and `login` (~152-155); import and update call sites the same way. Also replace the inline login in the "rejects an oversized password on authorize" test (~198-201), which duplicates the same cookie extraction, with `login(app, 'darthjee', 'my-password')`.
- `poll.e2e-spec.ts`: delete the local `createAuthorizationRequest` (~18-25); import it and update call sites to pass `app`.

Keep `request` and `INestApplication` imports only where still used; drop any that become unused.

## Files to Change
- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — add exported `createAuthorizationRequest(app, username)` and `login(app, username, password)`.
- `backend/src/auth/tests/authorization-request.controller.approver.e2e-spec.ts` — remove both local helpers, import shared ones, pass `app`.
- `backend/src/auth/tests/authorization-request.controller.abuse-hardening.e2e-spec.ts` — remove both local helpers, import shared ones, pass `app`; replace the inline login with `login()`.
- `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts` — remove the local `createAuthorizationRequest`, import the shared one, pass `app`.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- The inline login in abuse-hardening's DTO-length test was initially assumed out of scope; it turned out to be the same cookie extraction as `login()`, so it is folded in. Drop that sub-step if a strictly minimal diff is preferred.
- Other `auth.controller.*` / `admin.controller` specs with their own inline logins (e.g. `loginCookie()` in `auth.controller.account.e2e-spec.ts`) are out of scope.
- Files must stay under the 300-line ESLint limit; the support file is 82 lines today.
- Verify the docker service name (`kerghan_tests`) and script names against `docker-compose.yml` / `backend/package.json` when running.
