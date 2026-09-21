# Issue: Refactor: dedupe repeated test setup in frontend controller specs (AdminUsers, Register, AuthorizationRequests)

## Description
Several frontend controller specs repeat near-identical setup and expectations within a single file.

## Problem
jscpd flagged repeated blocks under `frontend/specs/assets/js/components/resources/`:

- `admin/pages/controllers/AdminUsersControllerSpec.js` — the same ~8-line block (build the controller, install a fake `window`, act, assert the redirect to `/` and that the state setter was untouched) appears three times, once each in the `#handleSearch`, `#handleGenerateLink` and `#handleSendEmail` 403 cases. Every case also repeats `new AdminUsersController(setUsers, setRowResults, setSearchError, client)`.
- `accounts/pages/controllers/RegisterControllerSpec.js` — the two success cases under `#handleSubmit` repeat the same `client.register` resolve + controller + fake-`window` setup (differing only in `isAdmin` and the assertions), and every `#validate` case repeats `new RegisterController(...)` with a one-field override.
- `accounts/pages/controllers/AuthorizationRequestsControllerSpec.js` — the `#authorize` and `#deny` describes contain the same three cases (success clears the row error and reloads; a 400 stores the error and does not reload; an expired session does nothing), differing only in the method, its arguments and the client method it stubs.

Note: `admin/pages/controllers/AdminUserEditControllerSpec.js`, also listed in the original report, was already deduplicated by #172 (it now delegates to `itBehavesLikeAnAccountEditFormController`) and is out of scope. The original jscpd line numbers are stale for the same reason.

## Expected Behavior
Repeated setup moves to a `beforeEach` or a local builder, and repeated cases are parameterised; assertions are unchanged, and every existing case is still exercised (same coverage, same pass/fail behaviour).

## Solution
For each of the three files, extract the repeated block into a local helper (a `buildController()` and/or `beforeEach`), and use a table-driven loop where cases differ only by input/expected value:

- **AdminUsersControllerSpec** — a local `buildController()`; a table-driven 403 case over `handleSearch` / `handleGenerateLink` / `handleSendEmail`.
- **RegisterControllerSpec** — a local `buildController()`; a table of `{ field, override }` rows for the `#validate` "flags a missing/malformed …" cases; shared setup for the two success cases.
- **AuthorizationRequestsControllerSpec** — a loop over `authorize` / `deny` generating the success / 400 / expired-session cases.

Use the existing `frontend/specs/support/fakeWindow.js` helper (already merged) for the fake `window`; no new spec-support module is needed unless a helper turns out to be shared across files. No production code changes.

## Benefits
Removes repetition (the original estimate was ~45 lines) and makes each case's distinguishing input obvious.
