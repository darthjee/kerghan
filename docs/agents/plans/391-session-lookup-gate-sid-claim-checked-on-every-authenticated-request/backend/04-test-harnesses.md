# Adapt test harnesses
Keep every existing spec green now that `JwtGuard` needs `SESSION_LOOKUP` and a real session.

- `core/tests/jwt.guard.spec.ts`: `buildGuard` passes a `SessionLookup` double (default: returns
  the user for a known `sid`); signed payloads include a valid `sid`; existing key-rotation /
  `alg: none` / empty-secret cases keep their meaning; `canActivate` is now awaited.
- `core/tests/request-logging.e2e-spec.ts` (no `AuthModule`): provide a `SESSION_LOOKUP` stub in
  `TestAppModule` so the guard resolves; keep the protected-route `401` expectations.
- Auth e2e apps (`auth/tests/support/build-auth-test-app.ts`) and
  `integrations/tests/support/build-integrations-test-app.ts`: the real `SessionService` query
  builder join cannot run on the per-entity in-memory repos. Preferred: a shared test-support
  `InMemorySessionLookup` (e.g. `auth/tests/support/in-memory-session-lookup.ts`) built over the
  in-memory `User` and `RefreshToken` repos, applying exactly the same rules (row by
  `sessionUuid`, `revokedAt === null`, `expiresAt > now`, user by `row.userId`), plugged in with
  `.overrideProvider(SESSION_LOOKUP)`. (An equivalent narrow join stub in `in-memory-repo.ts`,
  like the existing atomic-update stub, is acceptable if it is simpler.) The real query's
  correctness is covered by step 02's unit spec.
- `build-integrations-test-app.ts` signs tokens directly: mint them through `TokenService
  #issueTokens` (or save a matching active `RefreshToken` row and sign with its `sid`) so
  `owner` / `intruder` / `admin` hold real sessions. Keep the fast, bcrypt-free seeding.
- Any other spec that hand-signs an access token for a protected route gets a real session the
  same way (grep for `jwtService.sign(` / `.sign({ sub`).

## Files to Change
- `backend/src/core/tests/jwt.guard.spec.ts` — lookup double, `sid`, async.
- `backend/src/core/tests/request-logging.e2e-spec.ts` — `SESSION_LOOKUP` stub.
- `backend/src/auth/tests/support/in-memory-session-lookup.ts` — new shared double (or an
  `in-memory-repo.ts` stub).
- `backend/src/auth/tests/support/build-auth-test-app.ts` — override `SESSION_LOOKUP`; update its
  header comment.
- `backend/src/integrations/tests/support/build-integrations-test-app.ts` — override
  `SESSION_LOOKUP`, session-bound tokens.
