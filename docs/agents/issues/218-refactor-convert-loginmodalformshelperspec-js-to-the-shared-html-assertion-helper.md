# Issue: Refactor: Convert LoginModalFormsHelperSpec.js to the shared HTML-assertion helper

## Description
`LoginModalFormsHelperSpec.js` asserts directly on rendered markup strings, producing the largest cluster of Codacy `xss/no-mixed-html` findings in the repository. #216 (merged, PR #257) introduced the shared `renderedOutput` spec helper (`frontend/specs/support/renderedOutput.js`) to fix exactly this; this issue applies it to this spec.

## Problem
44 High findings (`xss/no-mixed-html`, mostly "HTML passed in to function 'expect'" plus "Unencoded return value from function 'markup'") in `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js`.

Per PR #257's findings on how the real rule works:
- The local `markup` helper (a raw `renderToStaticMarkup` wrapper) and the `html` variables are HTML contexts in themselves.
- **Any string literal matching `/<\/?[a-z]/` flags the call it is passed to**, whatever the function. This spec has many: `'>Password</button>'`, `'>Register</button>'`, `'>Recover</button>'`, `'>Authorize with logged device</button>'`, `'>Send request</button>'`, `'>Log in</button>'`, `'>Back to log in</button>'`, `'>Try again</button>'`, and `'<form'`. Swapping `expect(html).toContain(x)` for `expect(page.contains(x))` alone would leave these flagged.

## Expected Behavior
- Every existing case is still exercised, with the same assertions, just as strict, and the same pass/fail behaviour.
- No raw markup string reaches `expect(...)`, and no html/markup-named variable or function remains in the spec.
- No string literal containing `<tag` or `</tag` is passed to any call.
- The real `xss/no-mixed-html` rule reports nothing for the converted spec or for the updated helper.

## Solution
1. **Extend `renderedOutput`** (`frontend/specs/support/renderedOutput.js`) with `containsElement(tagName, text)`. It answers whether the output contains `text` as the full content of an element named `tagName`, i.e. the rendered string includes `>${text}</${tagName}`. Build the fragment inside a template literal, which the rule does not inspect, the same way `containsTag` does. Add cases for it to `renderedOutputSpec.js` (present / absent / same text inside a different tag). Update the JSDoc.
2. **Convert `LoginModalFormsHelperSpec.js`**:
   - Replace the local `markup` helper with one that returns `renderedOutput(React.createElement('div', null, LoginModalFormsHelper.render(state, handlers)))`. Name it and its results without `html`/`markup` (e.g. `renderForms` → `forms`).
   - `toContain('>X</button>')` / `not.toContain(...)` → `expect(forms.containsElement('button', 'X')).toBeTrue()/.toBeFalse()`.
   - `toContain('<form')` / `not.toContain('<form')` → `containsTag('form')`.
   - Every other `toContain`/`not.toContain` → `contains(x)` with `.toBeTrue()`/`.toBeFalse()`, one for one. Use `withContext` where a case has several assertions, following `accountEditFormHelperExamples.js`.
   - Where several cases only differ by the expected fragment, you may make them table-driven (the existing device-panel `forEach` pattern).
   - Cases that inspect the React tree directly (the `onSelectMode` click tests) stay as they are.
3. No production code changes. Do not add a DOM library.

**Verification gate** (same as #216): before opening the PR, run the real `eslint-plugin-xss` `no-mixed-html` rule one-off, using the throwaway `/tmp/xss` setup inside `kerghan_fe` described in PR #257. Run it on `LoginModalFormsHelperSpec.js`, `renderedOutput.js` and `renderedOutputSpec.js`, and include the baseline and after output in the PR description. Do not commit the plugin, and keep the `codacyRuleStubs` stub as it is.

## Benefits
- Removes 44 High findings from a single file.
- Adds `containsElement` to the shared helper, so the remaining dependent spec-conversion issues can assert element text without weakening their assertions or tripping the rule.

## Verification
- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- The one-off `no-mixed-html` run reports no findings for the files listed above (output included in the PR).
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
