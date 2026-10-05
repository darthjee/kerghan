# Password login, register and refresh wiring
Thread `keepSignedIn` through the password paths.

- `LoginDto`: `@IsOptional() @IsBoolean() keepSignedIn?: boolean;` (strict — no transform/coercion).
- `AuthService#login`: `issueTokens(user, dto.keepSignedIn ?? false)`.
- `AuthService#register`: explicitly regular — `issueTokens(user, false)` (or rely on the default and
  say so in the doc-comment).
- `AuthService#refresh`: pass the presented token row's `keepSignedIn` to `issueTokens`, so a
  persistent session keeps renewing with the persistent TTL. Replay detection and `logout` are
  unchanged.
- `AuthController` stays thin: no logic change beyond the DTO; `respondWithSession` and
  `status` responses are unchanged.

Specs: `auth.service.spec.ts` — login passes the flag (true/omitted), register passes `false`,
refresh carries `true`/`false` over from the presented row. e2e (`auth.controller.login.e2e-spec.ts`):
`keepSignedIn: true` accepted, omitted accepted, `"true"`/`1` → `400`; response body still
`{ user, refreshToken }`.

## Files to Change
- `backend/src/auth/dto/login.dto.ts` — optional strict boolean `keepSignedIn`.
- `backend/src/auth/auth.service.ts` — `login`/`register`/`refresh` pass the flag; doc-comments.
- `backend/src/auth/tests/auth.service.spec.ts` — flag propagation cases.
- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts` — validation cases.
