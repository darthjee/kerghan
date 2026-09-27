# Backend Plan: Support KERGHAN_SECRET_KEY rotation without downtime

Main plan: [plan.md](plan.md)

## Shared contracts

- Read `KERGHAN_SECRET_KEY` (current) and `KERGHAN_PREVIOUS_SECRET_KEYS` (optional,
  comma-separated) through `ConfigService` only, never `process.env`.
- Previous keys: trim each entry and drop blanks, duplicates and any entry equal to the
  current key.
- Sign with the current key only. When verifying, try the current key first, then each
  previous key in order.
- `cookie-parser` gets `[current, ...previous]`. The cache token uses the current key only.

## Steps

- [01 — Add the secret-keys resolver](backend/01-add-secret-keys-resolver.md)
- [02 — Verify JWTs against previous keys](backend/02-verify-jwt-against-previous-keys.md)
- [03 — Wire cookie-parser, JwtModule and the cache token to the resolver](backend/03-wire-consumers.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Do not add a boot-time failure when `KERGHAN_SECRET_KEY` is empty. Today's behaviour stays
  as it is, and that hardening is out of scope.
- Splitting the key into one secret per use is explicitly out of scope.
- `JwtService.verify(token)` with no options uses the module-level secret. The auth e2e test
  app (`auth/tests/support/build-auth-test-app.ts`) registers `JwtModule` with `'test-secret'`
  and sets no `KERGHAN_PREVIOUS_SECRET_KEYS`, so existing e2e specs must keep passing
  unchanged.
- An expired token signed with the current key will also fail against every previous key, so
  it still ends in the same `401 Invalid or expired access token`.
