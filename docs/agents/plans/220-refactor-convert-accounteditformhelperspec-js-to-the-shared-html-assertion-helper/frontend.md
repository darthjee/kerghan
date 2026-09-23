# Frontend Plan: Refactor: Convert AccountEditFormHelperSpec.js to the shared HTML-assertion helper

Main plan: [plan.md](plan.md)

## Overview
Spec-only refactor: extend `renderedOutput` with an ordering query, then convert `AccountEditFormHelperSpec.js` so it never holds or asserts on a rendered markup string. No production code changes.

## Context
`frontend/specs/assets/js/components/common/forms/helpers/AccountEditFormHelperSpec.js` renders `AccountEditFormHelper.render(state, handlers, options)` with `renderToStaticMarkup` and asserts with `expect(html).toContain('<...markup...>')`, plus one `indexOf`-based ordering case — 20 Codacy `xss/no-mixed-html` findings. #216 introduced `frontend/specs/support/renderedOutput.js` (boolean queries `contains`, `containsTag`, `containsElement`, `containsAttribute`) and converted `frontend/specs/support/accountEditFormHelperExamples.js` (`itBehavesLikeAnAccountEditFormHelper`), already used by `MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js`.

## Implementation Steps

### Step 1 — Add `containsInOrder` to `renderedOutput`
In `frontend/specs/support/renderedOutput.js`, add `containsInOrder: (...texts) => boolean` — true when every text is found in the rendered output, each one starting after the end of the previous match (walk with `rendered.indexOf(text, from)`; false as soon as one is missing). Keep the rendered string private, as today. Update the JSDoc (`@description`, `@returns` type and prose) to document it.

In `frontend/specs/support/renderedOutputSpec.js`, add a `#containsInOrder` block. The current fixture renders a single `<p>`, so render a small multi-child element for this block (e.g. a `div` with `h1` "Title", `p` "Body", `span` "Footer" via `React.createElement`), and cover:
- true for texts in rendered order;
- false for the same texts out of order;
- false when one of the texts is absent.

Also add a `containsInOrder` call to the "renders the element once" case.

### Step 2 — Convert `AccountEditFormHelperSpec.js`
Rewrite the spec:
- Import `itBehavesLikeAnAccountEditFormHelper` from `../../../../../../support/accountEditFormHelperExamples.js` and `renderedOutput` from `../../../../../../support/renderedOutput.js` (verify the relative depth against the existing `AccountEditFormHelper.jsx` import). Drop the `renderToStaticMarkup` import.
- Keep `buildOptions` (heading `Some Heading`, successMessage `Saved it.`, idPrefix `some-prefix-`). Call the shared examples inside the top `describe`, with a wrapper helper binding the options:
  ```js
  const Helper = {
    render: (state, handlers) => AccountEditFormHelper.render(state, handlers, buildOptions()),
  };
  const { buildHandlers, buildState } = itBehavesLikeAnAccountEditFormHelper({
    Helper,
    heading: 'Some Heading',
    successMessage: 'Saved it.',
    submitError: 'Boom',
    idPrefix: 'some-prefix-',
    changeFields: ['username', 'email', 'newPassword', 'newPasswordConfirmation'],
  });
  ```
  Use the returned `buildHandlers`/`buildState` instead of the local copies (delete those). The shared examples replace the current heading, id, save-button, values, submit-error, success and inline-error cases.
- Add a local `render(state, handlers, options)` returning `renderedOutput(AccountEditFormHelper.render(...))`, and keep, in a separate `describe` (e.g. `'.render (form-specific)'`) to avoid clashing with the shared `.render` block:
  - change-password section: `containsTag('hr')` and `containsElement('h2', 'Change password')`;
  - `handlers.onChange` wired in exactly `['username', 'email', 'newPassword', 'newPasswordConfirmation']` order (keep the `calls.allArgs()` `toEqual`, which is stricter than the shared `toHaveBeenCalledWith`);
  - without `leadingPasswordFields`: `contains('some-prefix-currentPassword')` is false;
  - with `leadingPasswordFields`: `containsAttribute('id', 'some-prefix-currentPassword')` is true, and `containsInOrder('Change password', 'some-prefix-currentPassword', 'some-prefix-newPassword')` is true (bare ids, no markup literals; unambiguous because each search starts after the previous match).
- No variable should hold rendered markup; all assertions go through `renderedOutput` queries with `withContext` where the file's neighbours use it.

## Files to Change
- `frontend/specs/support/renderedOutput.js` — add `containsInOrder`, update JSDoc.
- `frontend/specs/support/renderedOutputSpec.js` — cover `containsInOrder`.
- `frontend/specs/assets/js/components/common/forms/helpers/AccountEditFormHelperSpec.js` — reuse shared examples, convert remaining cases to `renderedOutput`.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `frontend-checks`)

## Notes
- `accountEditFormHelperExamples.js` must not change; the wrapper `Helper` is what adapts the three-argument `render`.
- The shared examples are looser than some current assertions (`>Save<`, heading text only) — accepted in the issue.
- Coverage must not drop; `renderedOutput.js` is spec support, so its new branch (missing text) must be exercised by `renderedOutputSpec.js`.
