# Issue: Refactor: dedupe authorization-request controller e2e specs (approver, abuse-hardening, poll, create)

## Description
The authorization-request controller e2e specs repeat the same request/expectation blocks many times (~120 duplicated lines across four files).
Owner: `backend` agent. All changes stay inside `backend/src/auth/tests/`.

## Problem
jscpd, all under `backend/src/auth/tests/`:

- `authorization-request.controller.approver.e2e-spec.ts` — 4 self-clones totalling 38 lines (e.g. 69-79 ↔ 35-68, 194-202 ↔ 112-120, 206-214 ↔ 163-171): every `mine` test re-issues the same `POST .../mine.json` with a cookie and asserts the response (5 occurrences, including the `X-Skip-Cache` test).
- `authorization-request.controller.abuse-hardening.e2e-spec.ts` — 3 self-clones totalling 33 lines (e.g. 95-107 ↔ 59-77, 128-138 ↔ 123-133): the over-limit `{ uuid, pollToken, expiresAt }` assertion and the create-under-limit loop are repeated. The two fill loops differ: per-IP sends distinct usernames from the same IP, per-username sends the same username with a varying `X-Forwarded-For`.
- `abuse-hardening` ↔ `authorization-request.controller.poll.e2e-spec.ts` lines 7-23 ↔ 6-22 and `approver` ↔ `authorization-request.controller.create.e2e-spec.ts` lines 3-16: identical imports/`describe`/`beforeEach`/`afterEach` scaffolding.
- `authorization-request.controller.create.e2e-spec.ts` lines 20-30 ↔ 33-43.
- Overall, the `{ uuid, pollToken, expiresAt }` `toEqual` block appears 6 times across `create` and `abuse-hardening`.

## Expected Behavior
Shared request/assert helpers and one setup helper exist; specs express only what is specific to each case. Same tests, same assertions, same test count — all specs pass — and jscpd no longer reports these clones.

## Solution
Add helpers to `authorization-request.controller.e2e-test-support.ts`:

- `postMine(app, cookie)` — issues the `POST /auth/authorization-requests/mine.json` call with the cookie.
- `expectUniformCreateResponse(body)` — asserts the `{ uuid, pollToken, expiresAt }` shape.
- `fillCreateLimit(app, { username: (i) => string, ip?: (i) => string })` — a single parametrised helper covering both the per-IP and per-username fill loops.
- `useTestApp()` — registers the `beforeEach`/`afterEach` (`buildTestApp()` / `app.close()`) hooks itself and returns a live context whose getters (e.g. `ctx.app`, `ctx.authorizationRequestRepo`) always reflect the current test's instance, since `app` is reassigned per test.

Scope is limited to the jscpd-flagged clones. Other repeated blocks (`postPoll`, `postAuthorize`, `postDeny`) are intentionally out of scope.

## Benefits
Shorter, easier-to-scan e2e specs; a response-shape change is one edit rather than a dozen.
