# backend Plan: Refactor: extract shared boolean-metadata-reading helper from AdminGuard/JwtGuard/SkipCacheInterceptor

Main plan: [plan.md](plan.md)

## Overview
`AdminGuard` (`#isAdminOnly`), `JwtGuard` (`#isPublic`), and `SkipCacheInterceptor` (`#isSkipCache`) each privately re-implement the same `Boolean(reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]))` snippet, differing only in which metadata key they read. Extract it into one shared, tested helper in `backend/src/core/`, matching the existing precedent set by `getNumberConfig` (`backend/src/core/numeric-config.ts`).

## Context
All three consumers live in `backend/src/core/` and are documented "Core," always-resident, global guards/interceptors — more of them reading route-level boolean metadata are expected over time. Behavior (which routes are treated as admin-only/public/skip-cache) must not change; this is a pure internal refactor.

## Implementation Steps

### Step 1 — Add `readBooleanMetadata` helper + spec
Create `backend/src/core/boolean-metadata.ts` exporting:

```ts
export function readBooleanMetadata(reflector: Reflector, key: string, context: ExecutionContext): boolean
```

It should be a direct extraction of the existing snippet (`Boolean(reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]))`) — no behavior change, no added logic. Follow the existing JSDoc/comment style used in `numeric-config.ts` and `lockout-state.ts` (a short "why" comment, not a restatement of the code).

Add `backend/src/core/tests/boolean-metadata.spec.ts` following the `numeric-config.spec.ts` pattern: a fake `Reflector` (`{ getAllAndOverride: jest.fn() }`) exercising both the `true`/truthy-metadata and `false`/undefined-metadata branches, and asserting `getAllAndOverride` is called with the given `key` and `[context.getHandler(), context.getClass()]`.

### Step 2 — Wire the helper into all three consumers
Replace each private duplicate method with a call to the shared helper, removing the now-dead private methods entirely:

- `backend/src/core/admin.guard.ts`: `#isAdminOnly(context)` → `readBooleanMetadata(this.reflector, IS_ADMIN_ONLY_KEY, context)`; remove `#isAdminOnly`.
- `backend/src/core/jwt.guard.ts`: `#isPublic(context)` → `readBooleanMetadata(this.reflector, IS_PUBLIC_KEY, context)`; remove `#isPublic`.
- `backend/src/core/skip-cache.interceptor.ts`: `#isSkipCache(context)` → `readBooleanMetadata(this.reflector, IS_SKIP_CACHE_KEY, context)`; remove `#isSkipCache`.

No behavior change, so the existing specs (`admin.guard.spec.ts`, `jwt.guard.spec.ts` if present, `skip-cache.interceptor.spec.ts`) should keep passing unmodified — run them to confirm rather than rewriting them.

## Files to Change
- `backend/src/core/boolean-metadata.ts` — new shared helper (Step 1).
- `backend/src/core/tests/boolean-metadata.spec.ts` — new spec for the helper (Step 1).
- `backend/src/core/admin.guard.ts` — replace `#isAdminOnly` with the shared helper (Step 2).
- `backend/src/core/jwt.guard.ts` — replace `#isPublic` with the shared helper (Step 2).
- `backend/src/core/skip-cache.interceptor.ts` — replace `#isSkipCache` with the shared helper (Step 2).

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Matches the pattern already established by five prior merged refactors in this repo (issues #133–#137: `assertAnyFieldPresent`, `getNumberConfig`, lockout-state, `hashToken`, `DUMMY_DIGEST`) — same shape: extract to `backend/src/core/`, add a focused spec, swap call sites, no behavior change.
- Scope was expanded during discussion from the original issue text (AdminGuard/JwtGuard only) to also include `SkipCacheInterceptor`, since it has the identical duplicated pattern.
