# Approve and deny routes, e2e specs

Add the thin routes to `AdminController`:

- `@Post('users/:id/approve.json')` → `{ user: this.#serializeUser(await adminService.approveUser(id)) }`.
- `@Post('users/:id/deny.json')` with `@CurrentUser()` →
  `{ user: this.#serializeUser(await adminService.denyUser(id, currentUser.sub)) }`.
- Both `ParseIntPipe` on `:id`, `200` status (use `@HttpCode(200)` if the controller's other POST
  routes do; match whatever `edit.json` answers).

E2e specs, from `api.md` "Required tests":

- `admin.controller.e2e-spec.ts`: approve → `403` non-admin, `404`, `422 USER_NOT_PENDING` from
  `approved` and `denied`, `200` from `pending` (and the pending user's existing session then
  passes the gate); deny → `403`, `404`, `422 CANNOT_DENY_SELF`, `200` from each status, every
  active refresh token revoked with `admin_denied`, already-revoked rows keep their reason, the
  denied user's access token answers `401` on its next request; `X-Skip-Cache: true` on both.
- Other admin routes on a denied user: `edit.json`, `recovery-link.json`,
  `send-recovery-email.json` behave as for any user and leave `status` `denied`.
- `admin.controller.default-user.e2e-spec.ts`: deny on the default user → `409
  DEFAULT_USER_MANAGED`, status unchanged, no token revoked.

## Files to Change

- `backend/src/auth/admin.controller.ts` — two routes.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — e2e specs.
- `backend/src/auth/tests/admin.controller.default-user.e2e-spec.ts` — default-user deny spec.
