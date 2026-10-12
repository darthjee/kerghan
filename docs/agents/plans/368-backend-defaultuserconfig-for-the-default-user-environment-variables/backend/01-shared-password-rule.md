# Shared password rule

Introduce a shared constant for the registration password minimum length so `RegisterDto` and `DefaultUserConfig` cannot drift.

- Add `PASSWORD_MIN_LENGTH = 8` in a small auth-module file (e.g. `backend/src/auth/password-rules.ts`), with a JSDoc comment saying it is the registration rule and is also enforced on `KERGHAN_DEFAULT_USER_PASSWORD`.
- Replace the literal `@MinLength(8)` in `RegisterDto` with `@MinLength(PASSWORD_MIN_LENGTH)`.
- Check whether other DTOs carry the same literal 8 for a *new* password (e.g. `reset-password.dto.ts`, `user-field-changes.dto.ts`). If they do, switch them to the constant too, since they express the same rule. Otherwise leave them alone.

## Files to Change
- `backend/src/auth/password-rules.ts` — new; exports `PASSWORD_MIN_LENGTH`.
- `backend/src/auth/dto/register.dto.ts` — use the constant.
- `backend/src/auth/dto/*.dto.ts` — only where the same new-password min-length literal exists.
