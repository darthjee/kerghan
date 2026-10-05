# Configurable TTLs and keepSignedIn in TokenService
Make `TokenService` choose the refresh-token TTL from config and persist the flag.

- Replace `REFRESH_TOKEN_TTL_MS` with `DEFAULT_REFRESH_TOKEN_TTL_MS` (7 days) and
  `DEFAULT_PERSISTENT_REFRESH_TOKEN_TTL_MS` (30 days).
- Inject `ConfigService` and `LoggerService` (keep the DI-only rule from the class doc-comment).
- `issueTokens(user: User, keepSignedIn = false)`: saves `keepSignedIn` on the new `RefreshToken` row
  and sets `expiresAt` from the matching TTL.
- TTL resolution per call: `getNumberConfig(configService, key, default)`; if the result is `<= 0`,
  use the default and log a warning (env var name + fallback value only, never token material) at
  most once per key per `TokenService` instance (e.g. a private `Set<string>` of keys already warned).
  Keys: `KERGHAN_REFRESH_TOKEN_TTL_MS`, `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`. No ordering check
  between the two.
- Update the class and method doc-comments (no more "7-day TTL"; describe both TTLs and the flag).

Specs (`token.service.spec.ts`): regular vs persistent TTL with defaults; both env vars honored;
non-numeric → default without warning; `0`/negative → default with exactly one warning across
repeated mints; `keepSignedIn` stored on the row (default `false` when omitted). Update the
`TokenService` construction in specs/test-support that build it directly.

## Files to Change
- `backend/src/auth/token.service.ts` — TTL constants, `ConfigService`/`LoggerService` injection, `issueTokens(user, keepSignedIn)`, TTL resolution + one-time warning, doc-comments.
- `backend/src/auth/tests/token.service.spec.ts` — new cases above; updated constructor wiring.
