# Issue: Complexity: auth.controller.e2e-spec.ts is 540 lines — split into focused spec files

## Description
Codacy's Lizard complexity check (`file-nloc-medium`) flags `backend/src/auth/tests/auth.controller.e2e-spec.ts` for its size. At the time the finding was raised the file was 540 non-comment lines; it has since grown further (673 lines as of this writing) as more auth scenarios were added, which underlines the problem rather than changing it.

## Problem
AGENTS.md caps files at 300 lines, and this spec file is now more than 2x that limit. It mixes shared test scaffolding (an in-memory TypeORM repo fake, a `matchesCondition` helper, throwaway `ProtectedTestController`/`PublicTestController` fixtures for exercising `JwtGuard`, and the app-building `beforeEach`) with e2e coverage for several unrelated concerns: login, password recovery/reset, refresh-token rotation, logout, session status, the `X-Skip-Cache` header contract, account editing, and the global `JwtGuard`. This makes it hard to find the exact scenario under test, slows down review, and increases merge-conflict risk when unrelated scenarios are touched in parallel — the same problem already fixed for the sibling authorization-request specs in #98 and #99.

## Solution
Split `auth.controller.e2e-spec.ts` by scenario, mirroring the file-naming pattern #98/#99 established (`<subject>.<concern>.e2e-spec.ts` + a shared `e2e-test-support.ts`):

- `auth.controller.e2e-test-support.ts` — shared, non-test exports: `matchesCondition`, `createInMemoryRepo`, `ProtectedTestController`, `PublicTestController`, and a `buildTestApp()` helper wrapping the current `beforeEach` (module compile with all repo overrides, cookie-parser, validation pipe, and registering the `darthjee` test user).
- `auth.controller.login.e2e-spec.ts` — the `login flow` and `access-token cookie maxAge` describe blocks (both scoped to `POST /auth/login.json`).
- `auth.controller.recovery.e2e-spec.ts` — the `recover flow` and `reset-password flow` describe blocks (`POST /auth/recover.json` and `POST /auth/reset-password.json`).
- `auth.controller.refresh-logout.e2e-spec.ts` — the `refresh token rotation`, `logout`, and `status check` describe blocks (all revolve around the refresh-token lifecycle).
- `auth.controller.skip-cache.e2e-spec.ts` — the standalone `X-Skip-Cache header` describe block, which asserts the header across login/register/refresh/logout responses together rather than belonging to any single endpoint.
- `auth.controller.account.e2e-spec.ts` — the `PATCH /auth/account.json` describe block.
- `auth.controller.guard.e2e-spec.ts` — the `JwtGuard` describe block.

Each resulting spec file re-declares its own top-level `describe('AuthController (e2e)', ...)` with its own `beforeEach`/`afterEach` app lifecycle via the shared `buildTestApp()` helper. No behavior or test-coverage change — this is a pure file-organization refactor.

## Benefits
- Each spec file stays under (or close to) the repo's 300-line cap, matching AGENTS.md.
- Easier to navigate: a reviewer or contributor working on one concern (e.g. account editing) only opens that concern's spec file.
- Fewer merge conflicts when multiple people add scenarios to different concerns at the same time.
