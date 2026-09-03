# Add `isAdmin` access-token claim and payload type

Carry the admin flag in the signed access token so `AdminGuard` can read it off `request.user`
without a DB hit.

- New file `backend/src/core/access-token-payload.ts` exporting an
  `AccessTokenPayload` interface: `{ sub: number; username: string; isAdmin: boolean }`, with a
  doc-comment noting it is the shape signed by `AuthService#issueTokens` and verified by
  `JwtGuard`. Placing it in `core/` (not `auth/`) avoids an `auth → core` type import cycle and
  lets `express.d.ts` import it.
- `AuthService#issueTokens` (`backend/src/auth/auth.service.ts`): change the sign call to
  `this.jwtService.sign({ sub: user.id, username: user.username, isAdmin: user.isAdmin })`.
  All three flows (`login`, `register`, `refresh`) already route through this method with a
  repository-loaded `User`.
- `backend/src/core/jwt.guard.ts`: change `#verify` to return `AccessTokenPayload` (cast the
  `jwtService.verify` result), and type the `request.user` assignment accordingly. Keep the
  `canActivate` flow otherwise unchanged.
- `backend/src/types/express.d.ts`: change `user?: object;` to
  `user?: AccessTokenPayload;` and import the type
  (`import type { AccessTokenPayload } from '../core/access-token-payload.js';`). Verify no
  other `request.user` reader breaks under the narrower type (currently only `jwt.guard.ts`
  writes it and nothing reads it yet).
- Spec updates in `backend/src/auth/tests/auth.service.spec.ts`:
  - Add `isAdmin: false` (and a promoted `isAdmin: true` variant where useful) to the `user`
    fixtures used by the `login` / `register` / `refresh` describe blocks.
  - Assert `jwtService.sign` is called with an object containing
    `isAdmin: <expected>` for a normal user and for an admin user (in `login`, and at least one
    of `register` / `refresh`).

## Files to Change

- `backend/src/core/access-token-payload.ts` — new `AccessTokenPayload` interface.
- `backend/src/auth/auth.service.ts` — include `isAdmin` in the signed token payload.
- `backend/src/core/jwt.guard.ts` — type the verified payload / `request.user` as
  `AccessTokenPayload`.
- `backend/src/types/express.d.ts` — narrow `Request.user` to `AccessTokenPayload`.
- `backend/src/auth/tests/auth.service.spec.ts` — fixtures + assertions for the `isAdmin` claim.
