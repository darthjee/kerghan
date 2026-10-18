# Approval flag and registration status

Read `KERGHAN_USER_APPROVAL_REQUIRED` with the codebase's boolean-flag rule (exactly `'true'` is
on, see `mail/mail.config.ts` and `default-user.config.ts`); there is no shared parser function
today, so a small helper next to `AuthService` (or an inline `configService.get(...) === 'true'`
read once in the constructor) is fine. `AuthService#register` sets `status` to `pending` when on,
`approved` otherwise. Nothing else reads the flag: it never touches existing users and never
disables the gate. `AdminService` / `AccountService` / `UserUpdateService` never write `status`.

Tests (model.md / README.md): flag unset → `approved`; `'true'` → `pending`; `'false'` and an
invalid value (e.g. `'yes'`) → `approved`; register response and cookies identical for both;
admin edit and `PATCH /auth/account.json` leave `status` unchanged.

## Files to Change
- `backend/src/auth/auth.service.ts` — flag read and status on register.
- `backend/src/auth/tests/auth.service.spec.ts`, `auth.controller.register.e2e-spec.ts` — coverage.
