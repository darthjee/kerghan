# Issue: Refactor: Convert AccountEditFormHelperSpec.js to the shared HTML-assertion helper

## Description
`frontend/specs/assets/js/components/common/forms/helpers/AccountEditFormHelperSpec.js` renders `AccountEditFormHelper.render(state, handlers, options)` with `renderToStaticMarkup` and asserts on the raw markup string (`expect(html).toContain('<div ...>')`, plus an `indexOf`-based ordering check).

## Problem
Codacy reports 20 High findings (`xss/no-mixed-html`) in this file.

**Depends on #216** (introduced the shared `renderedOutput` helper in `frontend/specs/support/renderedOutput.js` and converted `frontend/specs/support/accountEditFormHelperExamples.js`).

## Expected Behavior
The spec covers the same behaviour without holding or asserting on rendered markup strings, and without the findings above. No production code changes.

## Solution
1. **Reuse the shared examples.** Call `itBehavesLikeAnAccountEditFormHelper` from `accountEditFormHelperExamples.js`, passing a wrapper as `Helper` that binds the options (the shared examples call `Helper.render(state, handlers)` with two arguments):
   ```js
   const Helper = { render: (state, handlers) => AccountEditFormHelper.render(state, handlers, buildOptions()) };
   ```
   with `heading`, `successMessage`, `idPrefix`, `submitError` and `changeFields` (`username`, `email`, `newPassword`, `newPasswordConfirmation`) matching those options. It is accepted that the shared checks are looser than some current ones (e.g. `>Save<` instead of the full button markup, heading text instead of the container + `h1` markup). The examples file itself is not changed.
2. **Keep the spec-specific cases** not covered by the shared examples, converted to `renderedOutput` queries (`contains` / `containsTag` / `containsElement` / `containsAttribute`):
   - the change-password section (`hr` separator, `Change password` `h2`);
   - the exact list/order of fields wired to `handlers.onChange` (the current `toEqual` over `calls.allArgs()`);
   - without `leadingPasswordFields`: no `some-prefix-currentPassword` field;
   - with `leadingPasswordFields`: the leading field is rendered with the id prefix, and it appears after the `Change password` heading and before the new-password fields.
3. **Add `containsInOrder(...texts)` to `renderedOutput`** — a boolean query telling whether each text appears in the rendered output after the previous one — documented in the helper's JSDoc and covered in `frontend/specs/support/renderedOutputSpec.js`. Use it for the ordering case in step 2, replacing the `indexOf` comparisons.
4. Drop the `renderToStaticMarkup` import and every `html`/`markup` string variable from the spec.

## Benefits
- Removes 20 High findings from a single file.
- Removes duplicated cases by reusing the shared account-edit examples.
- `containsInOrder` becomes available to other specs that need ordering checks.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
