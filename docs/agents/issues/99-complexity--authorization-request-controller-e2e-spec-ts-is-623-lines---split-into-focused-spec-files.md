# Issue: Complexity: authorization-request.controller.e2e-spec.ts is 623 lines — split into focused spec files

## Description
`backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` has grown to 773 non-comment lines (623 at the time Codacy flagged it), more than double the 300-line cap AGENTS.md sets for backend files. It mixes shared test scaffolding (an in-memory TypeORM repo fake, an app-builder, a `matchesCondition` helper) with e2e coverage for several unrelated scenarios: request creation, the poll lifecycle, the approver-facing routes (mine/authorize/deny), and rate-limiting/abuse hardening.

## Problem
A single 773-line spec makes it hard to find the exact scenario under test, slows down review, and increases merge-conflict risk when unrelated scenarios are touched in parallel. This mirrors #98 (`authorization-request.service.spec.ts`), which was already split the same way.

## Solution
Split `authorization-request.controller.e2e-spec.ts` by scenario, mirroring the file-naming pattern #98 established for the sibling service spec (`authorization-request.service.<method>.spec.ts` + `authorization-request.service.test-support.ts`):

- `authorization-request.controller.e2e-test-support.ts` — shared, non-test exports: `matchesCondition`, `createInMemoryRepo`, `buildTestApp`.
- `authorization-request.controller.create.e2e-spec.ts` — the `create` describe block.
- `authorization-request.controller.poll.e2e-spec.ts` — full poll flow, expiry path, wrong poll token, concurrent post-approval polls, and the poll `X-Skip-Cache` header check.
- `authorization-request.controller.approver.e2e-spec.ts` — approver routes (`mine`, `authorize`, `deny`) and their `X-Skip-Cache` header checks.
- `authorization-request.controller.abuse-hardening.e2e-spec.ts` — rate limiting and abuse hardening (create per-IP limit, create per-username limit, concurrent open cap, authorize cool-off lockout, DTO length caps).

Each resulting spec file re-declares its own top-level `describe('AuthorizationRequestController (e2e)', ...)` with its own `beforeEach`/`afterEach` app lifecycle, importing the shared helpers from the new support file — same approach #98 took for the service spec.

## Benefits
Each file stays under the 300-line cap, is easier to scan for the exact scenario under test, and reduces merge-conflict risk between unrelated test changes.
