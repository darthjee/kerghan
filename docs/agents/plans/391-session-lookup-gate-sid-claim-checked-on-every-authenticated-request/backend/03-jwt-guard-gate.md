# Session gate in JwtGuard
Turn `JwtGuard` into the per-request session gate.

- Inject `SESSION_LOOKUP` (`@Inject(SESSION_LOOKUP) sessionLookup: SessionLookup`).
- `canActivate` becomes `async` (`Promise<boolean>`). Order after the `@Public()` check:
  1. extract the cookie (unchanged `Missing access token` when absent);
  2. verify signature/expiry against current then previous keys (unchanged);
  3. validate claims: `typeof sid === 'string'` holding a well-formed UUID and
     `typeof sub === 'number'` (integer); otherwise reject — never pass a non-string claim to
     the lookup;
  4. `const user = await sessionLookup.findActiveSessionUser(sid)`; reject when `null` or
     `user.id !== sub`;
  5. `request.user = { sub, sid, username: user.username, isAdmin: user.isAdmin }` from the
     looked-up user, not the claims.
- Every rejection in 3–4 throws the same `UnauthorizedException('Invalid or expired access
  token')` as the invalid-signature path (extract one private helper so the message cannot
  drift). Lookup errors are not caught.
- Update the class JSDoc (session gate, `request.user` from the DB, `sid`-less tokens
  rejected, link to the spec) and `AdminGuard` / `current-user.decorator.ts` JSDoc that claim the
  values come from the JWT.

## Files to Change
- `backend/src/core/jwt.guard.ts` — async gate, claim validation, lookup, `request.user` from DB.
- `backend/src/core/admin.guard.ts` — JSDoc only (`isAdmin` is now current).
- `backend/src/core/current-user.decorator.ts` — JSDoc only, if it describes the payload as the JWT.
