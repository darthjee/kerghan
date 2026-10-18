# Session-lookup gate and stale caveats in the auth module

Fold `specs/user-approval/security.md` into `docs/agents/modules/auth.md`, and rewrite the
caveats that the gate made false.

**"JWT/refresh-token flow" section**

- Access token bullet: document the `sid` claim. It holds the `sessionUuid` of the refresh-token
  session. Every minting path sets it: login, register, refresh, the winning poll and automatic
  login. Replace the "`AdminGuard` reads `isAdmin` with no per-request DB lookup / demotion takes
  effect on next refresh" wording.
- New sub-bullet or subsection, "Session lookup (`JwtGuard`)":
  - The three rules: an active row for `sid`, `row.userId === sub`, and the user is `approved`
    (always, whatever the flag says).
  - Claim validation: `sid` is a well-formed UUID string and `sub` is a number.
  - One indexed query per request.
  - The same `UnauthorizedException` for every rejection. Why: so a rejection can't be told
    apart from an invalid or expired token.
  - Rotation copies `session_uuid` to the new token.
- `request.user` is built from the joined user row: `{ sub, sid, username, isAdmin }`. The JWT
  still carries `username` and `isAdmin`, but they are not trusted for authorization.
- Tokens without `sid` get `401`. Why this logs no one out: `ApiClient` refreshes and retries.
  Also record the rejected alternative, a user-id-only lookup.
- "Immediate effects": these apply on the next request, not after the access-token TTL: deny,
  logout, session revoke, revoke-others, password-change revocations, admin demotion and
  username change. Rewrite the logout, password-change and sessions caveats ("access token stays
  valid until it expires") to match.
- Revocation reasons list: add `admin_denied` (set by `AdminService` deny, and by refresh /
  status on a denied user). It does not trigger replay detection.

**"Entities" section**: add the `auth_users.status` column (NOT NULL, `pending` / `approved` /
`denied`, always set explicitly by the creating service). Link to the new doc for transitions.

**"Admin tool routes" table**: add `status?` to the `search.json` body, add `status` to the item
shape, and add `currentUserId` to its response. Add rows for `approve.json` and `deny.json`, with
a link to the new doc. Update the route count in the cache-policy paragraph.

**"Admin authorization" section**: `AdminGuard` reads `isAdmin` from `request.user`, which
`JwtGuard` builds from the DB, so a demotion applies on the next request.

**"Device-authorization flow", "Status machine"**: add the `logged → denied` transition. The
winning poll re-checks the user's status on the fresh user row right before minting. A
non-approved user gets `{ status: "denied" }`, no session, and a conditional
`UPDATE ... WHERE status = 'logged'`.

**New short "User approval" section** (next to "Default user"): two or three sentences, the
product decision #389, and a link to `auth/user-approval.md`.

**"Testing" section**: name `core/tests/jwt.guard.spec.ts` and
`auth/tests/auth.controller.session-gate.e2e-spec.ts`.

## Files to Change
- `docs/agents/modules/auth.md` — gate, `sid`, `request.user`, immediate effects, `admin_denied`, `status` column, admin routes, `AdminGuard`, `logged → denied`, User approval pointer, Testing
