# Gate tests
Cover the spec's required tests owned by #391.

- **Unit (`core/tests/jwt.guard.spec.ts`):** active session of `sub` passes and sets
  `request.user` from the looked-up user (not the claims: differing `username` / `isAdmin` in the
  token are ignored); lookup returning `null` → `401`; lookup returning another user's id →
  `401`; token without `sid`, with non-string `sid`, non-UUID `sid`, or non-numeric `sub` →
  `401` and the lookup is never called; all with the exact invalid-token message; a lookup that
  throws propagates (not a `401`).
- **E2E (auth, via `buildAuthTestApp` + the throwaway guard controller in
  `auth.controller.e2e-test-support.ts`, e.g. in `auth.controller.guard.e2e-spec.ts`):**
  - revoked session (after logout, after `sessions/:uuid/revoke.json`) → old access token `401`
    on the next request;
  - expired session row → `401`;
  - unknown `sid` and a `sid` of another user's session (token for user A with B's `sid`,
    signed with the test secret) → `401`, body identical to the invalid-token response;
  - `sid`-less validly signed token → `401`; after `POST /auth/refresh.json` the retried request
    with the new cookie passes;
  - rotation: the access token from refresh carries the same `sid` and passes;
  - with `adminGuard: true`: demote the user in the in-memory repo → next request to an
    `@AdminOnly()` route is `403`; change the username → `@CurrentUser()` returns the new one.

## Files to Change
- `backend/src/core/tests/jwt.guard.spec.ts` — unit cases above.
- `backend/src/auth/tests/auth.controller.guard.e2e-spec.ts` — e2e gate cases (split into a new
  `auth.controller.session-gate.e2e-spec.ts` if it grows past the lint size limits).
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — throwaway route returning
  `@CurrentUser()` / an `@AdminOnly()` route, if not already there.
