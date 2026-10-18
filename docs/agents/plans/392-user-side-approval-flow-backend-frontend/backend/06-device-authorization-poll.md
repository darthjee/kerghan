# Device-authorization poll

In `AuthorizationRequestService#issueSessionFor`, after loading the user and **before**
`tokenService.issueTokens`: when `user.status !== 'approved'`, run a conditional update
`UPDATE ... SET status = 'denied', resolvedAt = now WHERE uuid = :uuid AND status = 'logged'`
and return `{ status: 'denied' }` (no `authResult`, so the controller sets no cookies). This is
the new `logged → denied` transition; check that the authorization-request `status` type / column
already allows `denied` (it does for `open → denied`). `authorize.json` needs no change (the gate
answers `401` to a non-approved caller).

Tests (api.md): `authorize` by a pending user → `401`; a user denied between `authorize` and
`poll` → `{ status: "denied" }`, no `Set-Cookie`, request ends `denied`; same when the status
flips after the claim but before the mint (stub the user load).

## Files to Change
- `backend/src/auth/authorization-request.service.ts` — status re-check before mint.
- `backend/src/auth/tests/authorization-request.service.poll.spec.ts`,
  `authorization-request.controller.poll.e2e-spec.ts`,
  `authorization-request.controller.approver.e2e-spec.ts` — coverage.
