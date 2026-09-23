# Issue: Refactor: Convert the admin specs to the shared HTML-assertion helper and drop dynamic keys in AdminUsersControllerSpec

## Description
The admin page specs check rendered markup strings directly, and `AdminUsersControllerSpec` looks up client and controller methods by name strings. Codacy reports these as High findings.

## Problem
Under `frontend/specs/assets/js/components/resources/admin/pages/`:

- `helpers/AdminUsersHelperSpec.js`: 21 `xss/no-mixed-html` (High). Every case calls `renderToStaticMarkup` and asserts on an `html` string, including `toContain('href="#/admin/users/1/edit"')` and `toContain('>Edit<')`.
- `AdminUsersSpec.js`: 2 `xss/no-mixed-html` (High). The default-state case renders to an `html` string and asserts `toContain('admin-users')`.
- `helpers/AdminUserEditHelperSpec.js`: 2 `xss/no-mixed-html` (High) at filing time. #216 has since moved this spec onto the shared `itBehavesLikeAnAccountEditFormHelper` examples and `page.contains(...)`, so it may already be clean.
- `controllers/AdminUsersControllerSpec.js:23` and `:27`: 2 `security/detect-object-injection` (High). The table-driven `itRedirectsHomeOn403` example does `client[clientMethod]` and `controller[method](...args)`.

## Expected Behavior
The specs keep the same cases, the same assertions and the same results. No production code changes.

## Solution
- **`AdminUsersHelperSpec.js` and `AdminUsersSpec.js`:** replace `renderToStaticMarkup` + `html` with `renderedOutput(...)` from `frontend/specs/support/renderedOutput.js` (added in #216 and extended in #218). Use `contains`, `containsTag` and `containsElement` with boolean matchers, as `LoginModalFormsHelperSpec` does. For example, `>Edit<` becomes `containsElement('a', 'Edit')`.
- **`renderedOutput.js`:** add `containsAttribute(name, value)`, which checks that the rendered output includes `name="value"`. Cover it in `renderedOutputSpec.js` and document it in the JSDoc, the same way #218 added `containsElement`. The edit-link assertion becomes `containsAttribute('href', '#/admin/users/1/edit')`, which is just as strict as before.
- **`AdminUsersControllerSpec.js`:** change `itRedirectsHomeOn403` to take functions instead of method-name strings, for example `{ title, stub: (c) => c.searchUsers, act: (controller) => controller.handleSearch('foo'), assertUntouched }`, so no bracket access with a variable key remains. Update all three call sites (`handleSearch`/`searchUsers`, `handleGenerateLink`/`generateRecoveryLink`, `handleSendEmail`/`sendRecoveryEmail`).
- **`AdminUserEditHelperSpec.js`:** verify only. It is expected to be clean already after #216, so change it only if lint or Codacy still flags it.

## Benefits
Clears the remaining High findings in the admin page specs and puts them on the same assertion helper as the rest of the spec suite.

## Verification
- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
