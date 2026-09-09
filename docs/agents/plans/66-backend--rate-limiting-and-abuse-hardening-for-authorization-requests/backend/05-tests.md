# Tests for all new limits

Extend the existing spec files (same mocking conventions already in place — hand-rolled repo mocks /
`configService = { get: jest.fn() }` in the unit spec, in-memory fake TypeORM repository in the e2e spec)
to cover:

- `create` over the per-IP limit and over the per-username limit — each rejected with the enumeration-safe
  over-limit response, applied identically for a known vs. unknown username.
- Concurrent-`open` cap: creating past the cap evicts the oldest `open` row (asserted via its `status`
  becoming `expired`) rather than rejecting the new create.
- Repeated wrong-password `authorize` trips the cool-off; the locked-out response is asserted to be the
  same status/message as an ordinary wrong-password rejection (and, where practical, that the same
  compare/dummy-compare code path still runs during lock).
- Client-IP resolution: a request with more `X-Forwarded-For` hops than the trusted-hop config falls back
  to the nearest untrusted hop rather than the attacker-supplied leftmost value.
- DTO validation rejects oversized `username`/`password` values.
- All existing enumeration-safety/uniform-`400` assertions still pass unchanged.

## Files to Change

- `backend/src/auth/authorization-request.service.spec.ts` — add cases for all of the above service-level
  behavior.
- `backend/src/auth/authorization-request.controller.e2e-spec.ts` — add e2e cases exercising `create` and
  `authorize` through the HTTP layer for the new limits.
- `backend/src/core/client-request.spec.ts` (or equivalent, if one exists — create if not) — unit cases
  for the trusted-hop-count IP resolution.
