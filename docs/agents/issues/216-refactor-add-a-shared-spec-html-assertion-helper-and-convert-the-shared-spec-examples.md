# Issue: Refactor: Add a shared spec HTML-assertion helper and convert the shared spec examples

## Description
Spec files pass rendered markup straight into `expect(...)`. Codacy's `xss/no-mixed-html` rule reports this as unencoded HTML in an HTML context. This is the pilot issue: it proves the approach that the dependent spec-conversion issues will then apply.

## Problem
Spec files have 155 High findings, mostly "HTML passed in to function 'expect'" (107) and "Unencoded return value from function `markup`/`renderToStaticMarkup`/`render`/`renderHtml`" (32). This issue owns the shared support files:

- `frontend/specs/support/accountEditFormHelperExamples.js`: 18 findings
- `frontend/specs/support/accountEditPageExamples.js`: 2 findings

`itBehavesLikeAnAccountEditFormHelper` also returns `renderHtml` to `MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js`, which run `expect(html)` on its output.

The repo's own ESLint config stubs this rule (`codacyRuleStubs` in `frontend/eslint.config.mjs`), so only Codacy reports it, and Codacy ignores inline disable comments. The rule works mostly by naming: it flags identifiers named like `html` or `markup` and raw `renderToStaticMarkup` return values.

## Expected Behavior
- The shared examples and the two caller specs make the same assertions, with the same pass/fail results.
- No raw markup string reaches `expect(...)` at any call site.
- The real `xss/no-mixed-html` rule reports nothing for the converted files or for the new helper.

## Solution
1. Add a helper under `frontend/specs/support/`, for example `htmlAssertions.js`, plus its own spec, as the other support helpers have.
   - It is a **string wrapper**: it takes a React element, runs `renderToStaticMarkup` internally once, and exposes only the assertions these call sites use, such as `contains(text)`, `notContains(text)` and `matches(regex)`.
   - Do **not** add a DOM library (jsdom, testing-library, and so on).
2. Convert `accountEditFormHelperExamples.js` and `accountEditPageExamples.js` to the helper.
3. Change `itBehavesLikeAnAccountEditFormHelper` to return a wrapper-producing function instead of `renderHtml`, and convert the 3 caller assertions in `MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js`.
4. `accountEditFormControllerExamples.js` is out of scope.

**Verification gate:** before opening the PR, run the real `eslint-plugin-xss` `no-mixed-html` rule on the helper, the two support files and the two caller specs with a one-off `docker-compose` command, and include the output in the PR description. Do not commit the plugin, and keep the stub as it is. If the rule still fires, including on the helper's internals, stop and revise the approach in the PR description before the dependent issues go ahead. Do not add per-file workarounds.

## Benefits
This unblocks the six dependent spec-conversion issues, which cite this one. It also removes 20 High findings directly.

## Verification
- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- The one-off `no-mixed-html` run reports no findings (output included in the PR).
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
