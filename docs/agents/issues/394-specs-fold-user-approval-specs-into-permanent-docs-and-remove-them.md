# Issue: Specs: fold user approval specs into permanent docs and remove them

## Description
Last sub-issue of Epic #389. It depends on #390, #391, #392 and #393, all merged.

Following the lifecycle in `docs/agents/specs.md`, move the lasting content of `docs/agents/specs/user-approval/` (README, model, security, api, ui) into the permanent docs, then delete the spec folder. This is a docs-only change, owned by the architect. Precedent: #373 (default user).

## Problem
While the spec is active, the user-approval feature and the session-lookup gate are defined only in `docs/agents/specs/user-approval/`. The only part already in the permanent docs is the `KERGHAN_USER_APPROVAL_REQUIRED` row in `environment-variables.md` (sections 1 and 5), added by #392.

Several permanent docs now say things that are no longer true, because the gate (#391/#392) checks the session and the user on every request:

- `modules/auth.md`, "JWT/refresh-token flow": `AdminGuard` reads `isAdmin` from the JWT with no DB lookup, and an admin demotion takes effect on the next refresh. The logout, password-change and session-revoke caveats say the access token stays valid until it expires.
- `modules/auth.md`, "Admin authorization": `AdminGuard` reads the `isAdmin` claim from the JWT.
- `backend/routes/auth.md`, `POST /auth/sessions/:uuid/revoke.json`: "Revocation stops the refresh token only".

The auth routes doc and the auth module doc also do not describe the `sid` claim, the user `status`, the new error codes, `admin_denied`, the device-authorization `logged → denied` transition, or the admin search filter, approve and deny routes. Deleting the folder now would lose information.

## Expected Behavior
- Every lasting decision in the spec is in a permanent doc. Nothing is lost.
- The caveats listed under Problem are rewritten to match the current behavior.
- `docs/agents/specs/user-approval/` is deleted and no link points to it anymore.
- `docs/agents/specs.md` lists no active spec ("none"). A new "User approval" row in "Completed specs" points to the permanent docs, with product decision #389.

## Solution
Fold each spec file into the permanent docs:

- **`modules/auth.md`, "JWT/refresh-token flow" (from `security.md`)**: the session-lookup gate is general auth, not specific to approval, so it goes here:
  - the `sid` claim and every path that sets it;
  - the `JwtGuard` session lookup (rules: active row, `row.userId === sub`, user `approved`), claim validation, and the single indexed query;
  - `request.user` built from the joined user row;
  - tokens without `sid` are rejected, with the refresh-and-retry reasoning and the rejected alternative;
  - the same `401` for every rejection (non-disclosure);
  - immediate effects: deny, logout, session revoke, revoke-others, password-change revocations, admin demotion and username change apply on the next request.

  Rewrite the stale caveats (access token valid until it expires, demotion on next refresh) and add `admin_denied` to the revocation reasons.
- **`modules/auth.md`, "Admin authorization"**: `AdminGuard` reads `isAdmin` from `request.user`, which is now built from the DB. Add the `search` / `approve` / `deny` routes to the "Admin tool routes" table.
- **`modules/auth.md`, "Device-authorization flow"**: add the `logged → denied` transition to the status machine (status re-check on the user row right before minting).
- **New `modules/auth/user-approval.md`**, linked from a short "User approval" section in `modules/auth.md` (same layout as `default-user.md`). It covers:
  - Overview and the `KERGHAN_USER_APPROVAL_REQUIRED` flag (sets only the status of a new registration; never changes existing users; never turns off the gate or the admin tools).
  - Model: the `status` column, the transitions (strict approve, lenient deny, `denied` is final, only approve and deny change it), the migration backfill to `approved`, and the demo seed.
  - Explicit exceptions: the auth endpoints that read the real status, and why.
  - Non-disclosure rules.
  - The default user: `status` is a managed field, forced to `approved` at boot, and deny is refused with `409`.
  - Admin review: the user item shape, `currentUserId`, any admin may deny another admin (accepted risk, #389).
  - Frontend: the `pending` auth state, the `status.json` re-check after register/login, the awaiting-approval view, re-check on focus and no timer polling, the denied login message, and the admin page filter and actions.
  - Out of scope: notifications, pagination of the admin listing, un-deny, slimming the JWT payload.
- **`backend/routes/auth.md`**: per-endpoint contracts for `register`, `login` (order of checks, the `403 USER_DENIED` body), `status.json` (pending row, cookies kept), `refresh.json` (pending rotates, denied gets `401` and `admin_denied`, order of checks), `recover.json`, `reset-password.json`, and the poll. Add the new error codes. Fix the session-revoke caveat.
- **`architecture/frontend.md`, "Auth flow"**: a short note on the `pending` state on the `AuthEvents` bus and the awaiting-approval view, linking to `modules/auth/user-approval.md`.
- **`modules/auth/default-user.md`**: add `status` (forced to `approved` by boot sync, deny refused with `409`) to "Edit blocking" and "Future write paths".
- **`product.md`**: add `status` to the default-user managed fields, and add a short "User approval" section linking to the new module doc.
- **`environment-variables.md`**: check that the existing row is complete (parsing like the other boolean flags); no new content expected.

Writing rules for the fold (same as #373):

- **Design rationale:** keep short "Why" notes next to each rule, so these decisions are not reopened. For example: why `sid`-less tokens are rejected, why the gate answers the same `401` for every rejection, why `refresh.json` rejects a denied user when deny already revokes every session, why approve is strict and deny is lenient, and why `status.json` keeps the cookies for a pending user.
- **Code is the source of truth:** where the merged code differs from the spec, document the code.
- **"Required tests" lists:** drop them. In their place, add a short "Testing" note that names the test files: `backend/src/core/tests/jwt.guard.spec.ts`, `backend/src/auth/tests/user-approval.config.spec.ts`, `backend/src/database/tests/auth-add-users-status-migration.spec.ts`, the approval / deny backend specs and e2e specs, and the frontend `awaitingApproval/`, `LoginModalController*` and admin `ApproveUserButton` / `DenyUserButton` specs.
- **Spec bookkeeping:** do not carry over the sub-issue map, the delivery order, or the "#394 adds …" notes.

Then delete `docs/agents/specs/user-approval/` and update `docs/agents/specs.md`.

## Acceptance criteria
- No information from the specs is lost, apart from the bookkeeping and "Required tests" lists listed above.
- `grep -r "specs/user-approval" docs` returns nothing outside `issues/` and `plans/`.
- The stale caveats in `modules/auth.md` and `backend/routes/auth.md` are rewritten.
- The spec folder is removed and `docs/agents/specs.md` is updated.
- No code changes.

## Benefits
- The user-approval feature and the session-lookup gate are documented where future work looks for them (module, routes, frontend and product docs), not in a temporary folder.
- The auth docs no longer describe the access token as valid until it expires after a revocation.
- Epic #389 is closed out following the specs lifecycle.
