# Backend Plan: Admin review: approve and deny new users (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

Produces every route in [plan.md](plan.md#shared-contracts): the admin user item with `status`,
`search.json` with the `status` filter and `currentUserId`, `approve.json`, `deny.json`, and the
new error codes `USER_NOT_PENDING` and `CANNOT_DENY_SELF`.

Already on `main` from #392, so reuse rather than re-add: `UserStatus`
(`backend/src/auth/entities/user.entity.ts`), `RevokedReason.ADMIN_DENIED`,
`ErrorCodes.USER_DENIED`, `TokenService#revokeUserTokens`,
`DefaultUserService#assertNotDefaultUser`.

## Steps

- [01 — Search: status filter, status field, currentUserId](backend/01-search-status-filter.md)
- [02 — Approve and deny in AdminService](backend/02-approve-deny-service.md)
- [03 — Approve and deny routes, e2e specs](backend/03-approve-deny-routes.md)
- [04 — Record currentUserId in the specs](backend/04-spec-docs.md)

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` and
  `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`)

## Notes

- Keep the controller thin: every status rule (pending-only approve, self / default-user
  refusal, revocation) lives in `AdminService`.
- Deny order matters: `404`, then default user `409`, then self `422`. A caller who is also the
  default user therefore gets `409`.
- `cache-policy.coverage.spec.ts` checks that every route declares a cache class; the new routes
  inherit the controller-level `@CachePolicy(CacheClass.Never)`, so the coverage spec should pass
  unchanged. Confirm it does.
- Do not fold anything into `docs/agents/modules/auth.md` or `backend/routes/`: that is #394's
  fold-in. Only the spec files under `docs/agents/specs/user-approval/` change here (step 04).
