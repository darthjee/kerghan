# Verify JWTs against previous keys
Make `JwtGuard` accept access tokens signed with a retired key during the overlap window.
Signing stays untouched: `auth/token.service.ts` keeps calling `jwtService.sign(...)` with the
module secret, which is the current key.

- Inject `ConfigService` into `JwtGuard` (it is global in both the app and the test harness,
  so no new providers are needed) and resolve `buildSecretKeys(configService).previous` once
  in the constructor.
- `#verify(token)`:
  1. Try `this.jwtService.verify<AccessTokenPayload>(token)` (module secret = current key).
  2. If that throws, try `this.jwtService.verify(token, { secret })` for each previous key in
     order and return the first success.
  3. If every attempt fails, throw the same
     `UnauthorizedException('Invalid or expired access token')`.
- Keep the method small enough for the project's `complexity` lint rule. If needed, extract
  the per-key attempt into a private helper that returns the payload or `undefined`.
- Update the class JSDoc to mention rotation support.

Specs (unit, JwtService with a real secret):
- a token signed with the current key → accepted
- a token signed with a configured previous key → accepted, with `request.user` populated
- a token signed with an unknown key → `401`
- an expired token signed with a previous key → `401`
- no previous keys configured → behaviour identical to today

If `JwtGuard` has no dedicated unit spec yet, add `core/tests/jwt.guard.spec.ts`. Existing e2e
coverage in `auth/tests/auth.controller.guard.e2e-spec.ts` must keep passing.

## Files to Change
- `backend/src/core/jwt.guard.ts`: previous-key fallback in `#verify`
- `backend/src/core/tests/jwt.guard.spec.ts`: new (or extended) unit spec
