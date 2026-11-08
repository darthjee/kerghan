# Specs: repositories — GitHub handle and default user

## Context

Part of Epic #444 (repositories listing). This is a spec-enhancement sub-issue: it refines
`docs/agents/specs/repos/model.md` and `docs/agents/specs/repos/ui.md`, which were written by the
Epic's first sub-issue (#445, "Specs: repositories feature definition", already merged) and
refined by #446 (exact API contract) and #447 (sync engine).

The repositories feature relies on a per-user **GitHub handle** to know whose public
repositories to list. That handle lives on `auth_users`, which is owned by the Auth module, and
it interacts with the env-managed **default user**, whose editable fields are currently all
blocked by `409 DEFAULT_USER_MANAGED`. Both need to be pinned down before implementation.

## What needs to be done

Docs only (`docs/agents/specs/repos/` and, where relevant, `docs/agents/modules/auth/`):

- **Column**: specify the nullable `github_handle` column on `auth_users` (owned by the Auth
  module) — type, validation (GitHub username format: letters, digits, single hyphens, no
  leading/trailing hyphen, max 39 characters), normalisation (trimming, case handling, empty
  string to `null`), and URL-encoding whenever it is interpolated into a GitHub URL.
- **How it is set**: through the existing self-edit `PATCH /auth/account.json` and the Account
  page (`#/account/my-account`) field; decide and document whether admins can edit it on other
  users.
- **Default user** (`docs/agents/modules/auth/default-user.md`): `github_handle` is **not**
  env-managed, so the `409 DEFAULT_USER_MANAGED` block must narrow to the managed fields
  (username, email, password) and let `github_handle` through. Define the new rule and update the
  documented "every editable field is managed today" rationale accordingly.
- **Handle changes**: define what happens to the stored public-source rows when the handle is
  changed or cleared.
- Add "Required tests" for each of the above.

## Acceptance criteria

- [ ] The specs describe the `github_handle` column, its validation and normalisation, and its
      URL-encoding when used.
- [ ] The specs describe the endpoint(s) and the Account page UI field used to set it, including
      whether admins can edit it.
- [ ] The narrowed default-user block is specified, and `default-user.md`'s rationale is updated.
- [ ] The effect of changing or clearing the handle on stored public-source rows is specified.
- [ ] Each area lists its "Required tests".
- [ ] No code changes.
