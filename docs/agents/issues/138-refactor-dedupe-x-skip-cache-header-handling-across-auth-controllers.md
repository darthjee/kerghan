# Issue: Refactor: dedupe X-Skip-Cache header handling across auth controllers

## Description
The `X-Skip-Cache` response header is set with a repeated one-liner across roughly 16 route handlers in three controllers, and one of the three controllers redeclares the header-name constant instead of importing it.

## Problem
`src/auth/auth.controller.ts` (5 handlers), `src/auth/admin.controller.ts` (4 handlers), and `src/auth/authorization-request.controller.ts` (5 handlers) each end their route handlers with `res.set(SKIP_CACHE_HEADER, 'true')`; `auth-response.ts`'s shared `respondWithSession` helper sets it once more. Additionally, `admin.controller.ts` locally redeclares its own `SKIP_CACHE_HEADER` constant instead of importing the already-exported `SKIP_CACHE_HEADER` from `auth-response.ts`, which `auth.controller.ts` and `authorization-request.controller.ts` both already do.

## Expected Behavior
`admin.controller.ts` imports the shared `SKIP_CACHE_HEADER` constant instead of redeclaring it, and every route handler in the three auth controllers gets the `X-Skip-Cache` header via a shared `@SkipCache()` decorator/interceptor instead of a hand-written `res.set(...)` call — user-scoped routes still reliably send the header.

## Solution
1. Update `admin.controller.ts` to import `SKIP_CACHE_HEADER` from `./auth-response.js` instead of redeclaring it.
2. Add a `@SkipCache()` decorator backed by a small `NestInterceptor` that sets the `X-Skip-Cache` header automatically for annotated routes/controllers.
3. Apply `@SkipCache()` across the ~15 route handlers in `auth.controller.ts`, `admin.controller.ts`, and `authorization-request.controller.ts` that currently call `res.set(SKIP_CACHE_HEADER, 'true')` by hand, removing that manual call from each. `auth-response.ts`'s shared `respondWithSession` helper is unaffected, since it isn't a controller route handler.

## Benefits
Removes a redundant constant declaration that could silently drift from the shared one, and reduces repeated per-handler boilerplate across all three auth controllers — lowering the risk that a new route forgets to set the header (which the `cache` agent already treats as a correctness requirement for user-scoped endpoints).
