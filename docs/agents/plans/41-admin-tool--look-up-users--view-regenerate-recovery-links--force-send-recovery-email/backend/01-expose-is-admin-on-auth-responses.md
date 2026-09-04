# Expose isAdmin on auth responses

The frontend cannot currently learn whether the logged-in user is an admin: the access-token
cookie is `httpOnly`, and every auth response strips the user down to
`{ id, username, email }`. Add `isAdmin` everywhere the frontend can read it.

`AuthController#serialize` (used by `login`/`register`/`refresh` via `#respond`) currently
returns `{ id: user.id, username: user.username, email: user.email }` — add `isAdmin:
user.isAdmin`.

`AuthService#status(refreshToken)` currently only returns `{ loggedIn: boolean }`, computed via
the private `#isActiveToken(refreshToken)` helper, which itself only returns a boolean (it looks
up the `RefreshToken` row but never the `User` row). Change `status()` to also resolve `isAdmin`:
when the token is active, look up the `User` by the token row's `userId` (via `userRepository`,
already injected into `AuthService`) and return its `isAdmin`; when inactive, return `isAdmin:
false` without an extra query. Keep `#isActiveToken` or refactor it to return the token row
instead of a boolean — either way, avoid two separate repository round-trips for the same
`RefreshToken` row.

## Files to Change

- `backend/src/auth/auth.controller.ts` — add `isAdmin: user.isAdmin` to `#serialize`'s return.
- `backend/src/auth/auth.service.ts` — extend `status()`'s return type to `Promise<{ loggedIn:
  boolean; isAdmin: boolean }>` and resolve `isAdmin` from the token's user when active.
- `backend/src/auth/tests/auth.controller.spec.ts`, `auth.controller.e2e-spec.ts`,
  `auth.service.spec.ts` — update expectations for the new `isAdmin` field on the relevant
  responses (admin and non-admin fixtures for both).
