# Issue: Refactor: dedupe login()/createAuthorizationRequest() e2e helpers across authorization-request controller specs

## Description
Three authorization-request e2e spec files each redefine identical `login()` and/or `createAuthorizationRequest()` helper functions.

## Problem
`createAuthorizationRequest(username = 'darthjee')` (POST `/auth/authorization-requests.json`, expect 201, return body) is defined identically in `authorization-request.controller.approver.e2e-spec.ts`, `.abuse-hardening.e2e-spec.ts`, and `.poll.e2e-spec.ts`. `login(username, password)` (POST `/auth/login.json`, extract `set-cookie[0].split(';')[0]`) is defined identically in `approver.e2e-spec.ts` and `abuse-hardening.e2e-spec.ts`. All three files already import from the shared `authorization-request.controller.e2e-test-support.ts`, which is the natural home for these helpers rather than each spec redefining them.

Each local copy closes over the spec's own `app` variable, which is why they can't simply be imported today.

## Expected Behavior
Both helpers live in the shared test-support file, taking the target `app` instance as an explicit first parameter (they can no longer close over a spec-local `app`); all three specs behave identically to before.

## Solution
Move `createAuthorizationRequest` and `login` into `authorization-request.controller.e2e-test-support.ts` with the signatures `createAuthorizationRequest(app, username = 'darthjee')` and `login(app, username, password)`, and update `approver.e2e-spec.ts`, `abuse-hardening.e2e-spec.ts`, and `poll.e2e-spec.ts` to import them and pass their `app` instead of each redefining their own copy. Remove the now-unused local definitions (and any imports they alone required).

Owning agent: `backend` (all files are under `backend/src/auth/tests/`; no new top-level folder).

## Benefits
Removes duplicated login/request-creation helpers across the authorization-request e2e suite and keeps them in the same shared file the specs already depend on for other fixtures.
