# Tests, spec sync and README row

**Tests** cover every item of `docs/agents/specs/repos/model.md` "Required tests → GitHub handle", plus the decisions recorded in issue #460. The handle-reconciliation items belong to #463.

- **Unit tests:**
  - `github-handle` normalisation and validation tables: `"  @DarthJee "` is stored as `darthjee`; `""`, `"  "`, `"@"` and `null` clear it. Accepted: `a`, `a-b`, `a1-b2-c3` and a 39-character handle. Rejected: a 40-character handle, `-a`, `a-`, `a--b`, `a_b`, `a.b`, `a/b`, `a b`, non-ASCII letters, and numbers, booleans, objects and arrays.
  - `assertAnyFieldPresent`: the account list (with a `null` `githubHandle` counting as present) and the unchanged admin message.
  - `AccountService`:
    - the handle-only path succeeds without, or with a wrong, `currentPassword`;
    - it never touches the abuse guard and skips the lockout;
    - a no-op edit (same value, a case-only change, an `@`-only change) issues no write;
    - a mixed edit without `currentPassword` answers `400`, counts as a failure and stores no handle;
    - a mixed edit with a refused managed field stores no handle.
  - `UserUpdateService`: the `githubHandle` key, including `null`.
  - `AccountHandleService`: the stored handle, `null` for no handle, `null` for no such user.
  - `DefaultUserService`: boot sync leaves `githubHandle` unchanged.
- **e2e tests** (extend `auth.controller.account.e2e-spec.ts`, `auth.controller.default-user.e2e-spec.ts` and `admin.controller.e2e-spec.ts`, following their support helpers):
  - **Account routes:**
    - a handle-only `PATCH` answers `200` with `{ username, email, githubHandle }`;
    - `{ "githubHandle": null }` is a valid edit;
    - `null` managed fields answer `400`;
    - saving a handle another user holds succeeds and reveals nothing;
    - `mine.json` returns the session's own account, answers `401` for a deleted user, and sends `X-Skip-Cache`.
  - **Default user:**
    - with the feature on, a handle-only edit answers `200`, and a mixed edit answers `409` and stores nothing;
    - with the feature off, the user is ordinary and every field is editable.
  - **Admin:**
    - `githubHandle` sent to `POST /admin/users/:id/edit.json` is stripped and never written;
    - a body holding only `githubHandle` answers `400`;
    - admin responses carry no `githubHandle`.
- **Cache:** `cache-policy.coverage.spec.ts` must pass with the new route. `AuthController` is already listed, so update its expectations only if it enumerates routes.

**Spec sync:** if anything above had to diverge from `docs/agents/specs/repos/model.md` / `security.md`, update them in the same PR.

**README row:** add #460's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md` (`| #460 | Repositories: Auth — GitHub handle on the account | implementation: model.md#github-handle, security.md#github-handle |`, matching the table's columns), and change the sentence below the table to say the implementation sub-issues are #460–#466.

## Files to Change
- `backend/src/auth/tests/github-handle.spec.ts`: new.
- `backend/src/auth/tests/assert-any-field-present.spec.ts`
- `backend/src/auth/tests/account.service.spec.ts`
- `backend/src/auth/tests/user-update.service.spec.ts`
- `backend/src/auth/tests/account-handle.service.spec.ts`: new.
- `backend/src/auth/tests/default-user.service.spec.ts`
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.default-user.e2e-spec.ts`
- `backend/src/auth/tests/admin.controller.e2e-spec.ts`
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: only if needed.
- `docs/agents/specs/repos/README.md`: the sub-issues table row.
- `docs/agents/specs/repos/model.md` / `security.md`: only on divergence.
