# New user-approval module doc

Create `docs/agents/modules/auth/user-approval.md` (title: "Auth: user approval"), laid out like
`modules/auth/default-user.md`. Sources: the spec's `README.md`, `model.md`, the non-gate parts of
`security.md`, the cross-cutting parts of `api.md`, and `ui.md`.

Sections:

1. **Overview**: what the feature does and the three statuses. Only `approved` is
   authenticated. Product decision #389. Link to the gate in `modules/auth.md`.
2. **Configuration**: `KERGHAN_USER_APPROVAL_REQUIRED`, with the flag → initial status table and
   the three things it never does. Link to `environment-variables.md` instead of repeating it.
3. **Status model**:
   - the column;
   - not exposed in auth `user` payloads (only in admin items, and as `status: "pending"` on
     `status.json`);
   - the transitions diagram and table. Why strict approve and lenient deny: deny covers both
     reject and ban;
   - `denied` is final;
   - only approve and deny change the status, never edit, My Account or reset;
   - turning the flag on or off changes no existing user.
4. **Migration and seeds**: the backfill to `approved` is mandatory, because the gate always
   applies. The `down` migration drops the column. Demo seeds are `approved`.
5. **Explicit exceptions**: the table of auth endpoints that read the real status, and why each
   one does. Link to the per-route contracts in `backend/routes/auth.md`.
6. **Non-disclosure**: the three rules.
7. **Admin review**:
   - always available;
   - the user item shape and `currentUserId`;
   - approve and deny semantics;
   - deny revokes every active token with `admin_denied`, and already-revoked rows keep their
     reason;
   - any admin may deny other admins (accepted risk, #389);
   - edit, recovery-link and send-recovery-email are unchanged, and why.

   Link to the admin route table in `modules/auth.md`.
8. **Default user**: `status` is a managed field, forced to `approved` at boot. Deny answers
   `409 DEFAULT_USER_MANAGED` (identified by id, `DefaultUserService#assertNotDefaultUser`). With
   the default-user feature off, it is a regular user.
9. **Frontend** (from `ui.md`):
   - the `pending` auth state on `AuthEvents`;
   - the `status.json` re-check after register and login;
   - the awaiting-approval view ("Check again" and "Log out");
   - a re-check on window focus and no timer polling. Why: `status.json` hits the DB and is never
     cached;
   - the denied login message;
   - the admin page filter, status column, approve and deny actions with confirmation, the
     actions that are hidden, and the errors that are surfaced.

   Check the component names against `frontend/assets/js/components/common/awaitingApproval/`
   and `components/resources/admin/pages/users/`.
10. **Out of scope**: notifications, pagination of the admin listing, un-deny, slimming the JWT
    payload to `{ sub, sid }`.
11. **Testing**: name the backend specs (`user-approval.config.spec.ts`,
    `auth-add-users-status-migration.spec.ts`, `admin.service.spec.ts`,
    `admin.controller.e2e-spec.ts`, `auth.controller.{login,register,recovery,refresh-logout,auto-login}.e2e-spec.ts`,
    `authorization-request.*poll*`) and the frontend specs (`awaitingApproval/`,
    `LoginModalControllerDeniedSpec.js`, `LoginModalControllerStatusRecheckSpec.js`,
    `ApproveUserButtonSpec.js`, `DenyUserButtonSpec.js`, `AuthStatusSpec.js`). Check each name
    exists before listing it.

## Files to Change
- `docs/agents/modules/auth/user-approval.md` — new file
