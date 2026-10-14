# Issue: Specs: fold the default user specs into permanent docs and remove them

## Description
Part of Epic #366. This is the last sub-issue and depends on all the others (#367–#372, #374, #375).

Following the lifecycle in `docs/agents/specs.md`, move the lasting content of `docs/agents/specs/default-user/` into the permanent docs, then delete the spec folder. This is a docs-only change, owned by the architect.

## Problem
While the spec is active, the default-user feature is defined only in `docs/agents/specs/default-user/` (README, configuration, boot-sync, edit-blocking, automatic-login, security, standalone). Some content has already been copied into the permanent docs by #371/#372 (`standalone.md`, and the standalone contract table in `environment-variables.md`). The backend side has not been copied: section 1 of `environment-variables.md` (backend runtime) does not list the `KERGHAN_DEFAULT_USER_*` variables, and `modules/auth.md` and `backend/routes/auth.md` do not mention the default user. `standalone.md` still links to `specs/default-user/standalone.md`. Deleting the folder now would lose information and leave broken links.

## Expected Behavior
- Every lasting decision in the spec is in a permanent doc. Nothing is lost.
- `docs/agents/specs/default-user/` is deleted and no link points to it anymore.
- `docs/agents/specs.md` lists no active spec ("none"). A new "Default user" row in "Completed specs" points to the permanent docs, with product decision #366.

## Solution
Fold each spec file into the permanent docs:

- **`environment-variables.md`, section 1 (backend runtime):** every `KERGHAN_DEFAULT_USER_*` variable with its default, the accepted flag values, value handling, and the boot validation rules (from `configuration.md`). The section 5 standalone table stays and links back to section 1.
- **New `modules/auth/default-user.md`**, linked from `modules/auth.md` (same layout as `modules/integrations/`). It covers:
  - `DefaultUserConfig`.
  - Boot sync: create or synchronize the user, password handling, collisions and races, the disabled flag.
  - Edit blocking: what is blocked, how the default user is identified, the per-field rule, the order of checks in `AccountService.updateAccount` and `AdminService.editUser`, password recovery and reset, edge cases, compatibility, future write paths.
  - How automatic login fits the JWT/refresh flow.
  - The security warnings: admin access, the IP allowlist, the production guard (`KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION`), session flooding, credentials, and sessions that stay valid after the feature is turned off.
  - Out of scope: a frontend indicator, more than one default user, removing the user when the flag is turned off, the demo-user seed, turning the feature on in production deployments.
- **`backend/routes/auth.md`:** the `POST /auth/status.json` automatic-login contract (when it applies, response body, cookies, session lifetime, a disallowed IP or the feature turned off, caching, session metadata, the boot warning), and the `409` response for blocked edits on `PATCH /auth/account.json`, password recovery and reset. The `409` on `POST /admin/users/:id/edit.json` goes with the admin routes in `modules/auth.md` (or links to the new file).
- **`standalone.md`:** check that the `kerghan.env` defaults, `auto-login`, `bind`, the unsafe-combination warning, client-managed variables, the allowlist value, standalone exposure and `kerghan update-env` are all present, and add what is missing. Keep the measured effective-client-IP findings (#371, Docker Desktop for macOS) and record the unverified items (Linux host, full end-to-end check, Docker Engine 28 loopback check) as caveats that link to #384. Replace the link to `specs/default-user/standalone.md`.
- **`product.md`:** a short entry describing the default-user feature, linking to the new module doc.

Writing rules for the fold:

- **Design rationale:** keep short "Why" notes next to each rule (automatic login only in `status.json` and not in the guard or `JwtGuard`, why blocked edits return `409`, why the allowlist keeps the full private-range list), so these decisions are not reopened.
- **"Required tests" lists:** drop them. In their place, add a short "Testing" note that names the spec files: `backend/src/auth/tests/default-user*.spec.ts`, the `*.default-user.e2e-spec.ts` files, and the standalone bats tests.
- **Spec bookkeeping:** the sub-issue map, the "variables live only here" note and the lifecycle section are not carried over.

Then delete `docs/agents/specs/default-user/` and update `docs/agents/specs.md`.

## Acceptance criteria
- No information from the specs is lost, apart from the bookkeeping and "Required tests" lists listed above.
- `grep -r "specs/default-user" docs` returns nothing outside `issues/` and `plans/`.
- The spec folder is removed and `docs/agents/specs.md` is updated.
- No code changes.

## Related
- #384: the open verification of the standalone effective client IP, split out of this issue.

## Benefits
- The default-user feature is documented where future work looks for it (module, routes and environment docs), not in a temporary folder.
- Epic #366 is closed out following the specs lifecycle.
