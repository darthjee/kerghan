# Backend Plan: Backend Authorization Request Entity Migration And Create Poll Endpoints

Main plan: [plan.md](plan.md)

## Steps

- [01 — Entity and migration](backend/01-entity-and-migration.md)
- [02 — Shared auth-response helper and client-request helper](backend/02-shared-helpers.md)
- [03 — DTOs and events](backend/03-dtos-and-events.md)
- [04 — AuthorizationRequestService](backend/04-authorization-request-service.md)
- [05 — Controller and module wiring](backend/05-controller-and-module.md)
- [06 — Environment variable docs](backend/06-docs.md)
- [07 — Tests](backend/07-tests.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Verified against the current codebase before planning: `TokenService.issueTokens(user)` exists
  at `backend/src/auth/token.service.ts:61` and is already an internal (non-exported) `AuthModule`
  collaborator, usable directly by the new service.
- The `status` enum column is the **first** native `type: 'enum'` TypeORM column in this backend —
  no existing precedent to copy beyond what the issue itself specifies.
- No `.helper.ts`-suffixed files exist anywhere in `backend/src` — `client-request.ts` and
  `auth-response.ts` must follow the bare-name convention (see `core/log-context.ts`,
  `core/access-token-payload.ts`).
- `createInMemoryRepo` is **not** a single shared e2e fake — it's duplicated locally per spec file
  (`auth.controller.e2e-spec.ts` and `admin.controller.e2e-spec.ts` each have their own divergent
  copy, neither with a `createQueryBuilder` stub). The new
  `authorization-request.controller.e2e-spec.ts` needs its own local copy, extended with a
  `createQueryBuilder().update().set(...).where(...).execute()` stub.
- Out of scope (deferred to other #58 sub-issues): approver-side endpoints (`mine`/`authorize`/`deny`),
  rate-limiting/concurrent-`open` caps, physical purge of resolved rows, and any frontend work.
