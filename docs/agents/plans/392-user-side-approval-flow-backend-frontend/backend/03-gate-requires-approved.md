# Gate rule 3: require `approved`

`SessionService#findActiveSessionUser` (the `SessionLookup` implementation) adds
`AND user.status = 'approved'` to its query, so a non-approved user's session resolves to `null`
and `JwtGuard` throws its existing `INVALID_TOKEN_MESSAGE` `401`, whatever the flag. Keep
`core/` free of any `auth/` import; `JwtGuard` itself needs no code change beyond its doc-comment
(mention rule 3). Update `core/session-lookup.ts`'s contract doc: "returns a user only for an
active session of an `approved` user".

Tests (security.md "Status (#392)" and "Non-disclosure"): a `pending` and a `denied` user's
otherwise valid token answer `401` on a business endpoint, flag on and off, byte-for-byte the
invalid-token response; an approved user passes.

## Files to Change
- `backend/src/auth/session.service.ts` — status filter in the lookup.
- `backend/src/core/session-lookup.ts`, `backend/src/core/jwt.guard.ts` — doc-comments.
- `backend/src/auth/tests/session.service.spec.ts`, `auth.controller.session-gate.e2e-spec.ts` — coverage.
