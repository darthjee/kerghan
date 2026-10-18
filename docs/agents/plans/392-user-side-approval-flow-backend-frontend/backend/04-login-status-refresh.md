# Login, status and refresh

**Login** (`AuthService#login`): after `#validateCredentials` succeeds, a `denied` user →
`ForbiddenException({ code: ErrorCodes.USER_DENIED, message: 'This account has been denied access' })`,
no tokens. `pending` and `approved` → tokens as today.

**Status** (`AuthService#status`): with an active token row, load the user and branch:
`approved` → unchanged; `pending` → `{ loggedIn: false, isAdmin: false, status: 'pending' }`;
`denied` → revoke the presented row (`revokedAt IS NULL` guard, reason `ADMIN_DENIED`) and fall
through to the no-session flow (`defaultUserService.autoLogin`). Extend `StatusResult`
(`token.service.ts`) with an optional `status: 'pending'`. In `AuthController#status`, do not
clear cookies when `status === 'pending'`; return `status` only when present. Keep this as data
returned by the service (thin controller).

**Refresh** (`AuthService#refresh`): after `#findActiveRefreshToken` (which keeps replay
detection first, unchanged) and the user load: `denied` → revoke the presented row with
`ADMIN_DENIED` (guarded on `revokedAt IS NULL`) and throw the plain `401`
('Invalid or expired refresh token'), so the controller clears cookies as for any refresh `401`.
`pending` → rotate as today.

**Logout** (`DELETE /auth/logoff.json`): already `@Public()` and revokes by the
`refresh_token` cookie, so a pending user can log out with no change. Add a test only.

Tests (api.md): every `status.json` table row, including cookies kept for pending, cleared for
denied, automatic login applying to a caller whose denied session was presented; `status` absent
from non-pending bodies. Login: wrong password on denied → `401`; correct → `403 USER_DENIED`, no
`Set-Cookie`; pending → `200` with cookies. Refresh: pending rotates; denied → `401`, cookies
cleared, row revoked `admin_denied`, replay detection not triggered; a `rotated` replay of a
denied user still triggers replay detection. Logout as a pending user clears cookies.

## Files to Change
- `backend/src/auth/auth.service.ts` — login, status, refresh branches.
- `backend/src/auth/token.service.ts` — `StatusResult.status`.
- `backend/src/auth/auth.controller.ts` — `status.json` cookie rule and body.
- `backend/src/auth/tests/auth.service.spec.ts`, `auth.controller.login.e2e-spec.ts`,
  `auth.controller.refresh-logout.e2e-spec.ts`, `auth.controller.auto-login.e2e-spec.ts`,
  `auth.controller.spec.ts` — coverage.
