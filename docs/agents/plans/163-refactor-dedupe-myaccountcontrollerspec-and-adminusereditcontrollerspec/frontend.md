# Plan: Refactor: dedupe MyAccountControllerSpec and AdminUserEditControllerSpec

Issue: [163-refactor-dedupe-myaccountcontrollerspec-and-adminusereditcontrollerspec.md](../../issues/163-refactor-dedupe-myaccountcontrollerspec-and-adminusereditcontrollerspec.md)

## Overview
Both controllers now extend `AccountEditFormController` (#162), but their two specs still re-declare the same ~60 lines of `#validate` / `#handleSubmit` cases plus the same spy setup. Add a shared example-group module, register it from both specs, and move the cases that are genuinely specific to one controller into that controller's spec.

## Context
- Specs live in `frontend/specs/assets/js/components/resources/{accounts,admin}/pages/controllers/`. The base class already has its own spec, `frontend/specs/assets/js/components/common/forms/controllers/AccountEditFormControllerSpec.js`, which stays as is.
- Jasmine runs `specs/**/*[sS]pec.js` (`frontend/package.json`, `jasmine.spec_files`), so the new shared module **must not** end in `Spec.js`/`spec.js`, or Jasmine will run it as a spec on its own. `frontend/specs/support/` currently holds only `jsx-loader.mjs`.
- `specs/**` is excluded from c8 coverage and gets Jasmine globals and relaxed JSDoc rules from `frontend/eslint.config.mjs`, so the new file needs no lint config changes. Keep it under the `max-lines` warn threshold of 300.
- Differences the shared group has to parameterise:
  - client method: `updateAccount` (MyAccount) vs `editUser` (Admin);
  - `handleSubmit` signature: `(fields)` vs `(userId, fields)`, and the matching expected client call (`updateAccount(payload)` vs `editUser(1, payload)`);
  - response shape: flat `{username, email}` vs `{user: {username, email}}`;
  - MyAccount's extra `currentPassword` field, which is always in the payload and is cleared on success.
- Decisions from the issue discussion: shared example group (not "trim to base-spec only"); support lives in `specs/support/`; the shared group holds the **superset** of cases (cases only one spec has today, such as the "password too short" submit error, start running for both).

## Steps

- [01 — Add the shared example group](frontend/01-add-shared-examples.md)
- [02 — Migrate MyAccountControllerSpec](frontend/02-migrate-my-account-spec.md)
- [03 — Migrate AdminUserEditControllerSpec](frontend/03-migrate-admin-user-edit-spec.md)

## CI Checks
- `frontend/`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend/`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm` on the host; always go through `docker-compose` (see `CLAUDE.md`).
- Before starting, record the number of specs in the three controller spec files (`yarn coverage` output), and afterwards confirm that each controller's spec count is unchanged or higher, and that the two controllers' statement/branch coverage under `assets/js/components/resources/{accounts,admin}/pages/controllers/` is unchanged or higher.
- Relative import depth: from a spec in `.../pages/controllers/` the support module is `../../../../../../../support/accountEditFormControllerExamples.js` (seven `..`); verify by running the specs.
- The first, fully generic assertions should be the ones kept in the shared group. Anything that only holds for one controller (see the file lists in steps 02/03) must stay in that controller's spec, so the shared group never needs `if (isAdmin)` branches.
- After the change, re-check with jscpd (if available locally, or via Codacy on the PR) that the 59-, 11- and 7-line clones from the issue are gone.
