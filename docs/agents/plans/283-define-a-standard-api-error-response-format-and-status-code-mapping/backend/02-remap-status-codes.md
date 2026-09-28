# Remap status codes and attach specific codes

Bring the existing throw sites in line with the documented mapping:

- **Username/email taken → `409`** with specific codes:
  - `AuthService#assertAvailable` (register): replace
    ``new BadRequestException(`${field} is not available`)`` with
    `new ConflictException({ message: \`${field} is not available\`, code: field === 'username' ? USERNAME_TAKEN : EMAIL_TAKEN })`.
  - `AuthService#assertFieldAvailable` (account and admin edits: "Username already in use" /
    "Email already in use"): throw `ConflictException` with the matching specific code. Pass the
    code in from the caller next to the message, or derive it from `field`.
- **Lockout → a dedicated exception**: add `LockedException` (e.g. `backend/src/core/locked.exception.ts`,
  extending `HttpException` with status `423`) and use it in `AccountService#assertNotLockedOut`
  instead of the raw `HttpException(..., HTTP_STATUS_LOCKED)`. Drop the local `HTTP_STATUS_LOCKED`
  constant if nothing else uses it. The filter maps it to `LOCKED`.
- Every other throw site keeps its current status and message and gets its category code from the
  filter. In particular, leave the enumeration-safe uniform errors untouched.

Update the unit specs that assert these exceptions (`auth.service.spec.ts`,
`account.service.spec.ts`, `admin.service.spec.ts`, `user-update.service.spec.ts` if affected) and
any e2e spec that expects `400` for a taken username/email so it now expects `409`.

## Files to Change
- `backend/src/auth/auth.service.ts` — `ConflictException` + specific codes in both availability checks.
- `backend/src/auth/account.service.ts` — use `LockedException`.
- `backend/src/core/locked.exception.ts` — new `423` exception.
- `backend/src/auth/tests/auth.service.spec.ts`, `account.service.spec.ts`, `admin.service.spec.ts` —
  updated expectations.
- `backend/src/auth/tests/*.e2e-spec.ts` — `400` → `409` wherever a taken username/email is asserted.
