# Plan: Refactor: Convert FormFieldsHelperSpec.js to the shared HTML-assertion helper

Main plan: [plan.md](plan.md)

## Overview
Rewrite `frontend/specs/assets/js/components/common/forms/helpers/FormFieldsHelperSpec.js` so it no longer calls `renderToStaticMarkup` or asserts against HTML-literal strings. Use the shared `renderedOutput` helper (`frontend/specs/support/renderedOutput.js`, from #216) instead, following the style of the specs already converted in #219/#220/#221 (e.g. `AccountEditFormHelperSpec.js`). No production code changes.

## Context
- The spec currently has 17 High Codacy findings (`xss/no-mixed-html`), all from markup literals in `toContain`/`toBe` assertions.
- `renderedOutput(element)` renders once and exposes boolean queries: `contains(text)`, `containsTag(tagName)`, `containsElement(tagName, text)`, `containsAttribute(name, value)`, `containsInOrder(...texts)`.
- #214 already refactored `FormFieldsHelper` internals. The rendered output is unchanged.
- Decision made while refining the issue: the two exact `toBe(...)` matches become a class check plus an element-text check. **Do not** add an exact-equality query to `renderedOutput.js`.

## Implementation Steps

### Step 1 — Convert the `.renderField` cases
- Replace the `renderToStaticMarkup` import with `import { renderedOutput } from '../../../../../../support/renderedOutput.js';` (same relative depth as `AccountEditFormHelperSpec.js`).
- Make the local `render(state, onChange)` return `renderedOutput(FormFieldsHelper.renderField(...))`.
- Map each assertion to a boolean check with `.withContext(...)`, as the converted specs do:
  - `for="my-prefix-username"` → `containsAttribute('for', 'my-prefix-username')`
  - `id="my-prefix-username"` → `containsAttribute('id', 'my-prefix-username')`
  - `type="text"` → `containsAttribute('type', 'text')`
  - `value="foo"` → `containsAttribute('value', 'foo')`
  - `>Username</label>` → `containsElement('label', 'Username')`
  - `is-invalid` present/absent → `contains('is-invalid')` `.toBeTrue()`/`.toBeFalse()`
  - `<div class="invalid-feedback">is required</div>` → `containsAttribute('class', 'invalid-feedback')` + `containsElement('div', 'is required')`
  - `invalid-feedback` absent (both the "no error for the field" and the "missing fieldErrors" cases) → `contains('invalid-feedback')` `.toBeFalse()`
- Leave the element-level test (`element.key`, `element.props.children[1].props.onChange`) unchanged. It doesn't render markup.

### Step 2 — Convert `.renderSubmitError` and `.renderSuccess`
- Replace `expect(html).toBe('<div class="alert alert-danger">Boom</div>')` with `renderedOutput(...)` checks: `containsAttribute('class', 'alert alert-danger')` and `containsElement('div', 'Boom')`.
- Same for success: `containsAttribute('class', 'alert alert-success')` and `containsElement('div', 'Saved.')`.
- Leave the `toBeNull()` cases unchanged.
- Confirm that no HTML literal (`<`, `</`, `="`) is left in any string in the file.

## Files to Change
- `frontend/specs/assets/js/components/common/forms/helpers/FormFieldsHelperSpec.js`: convert to `renderedOutput` and remove every markup literal.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`). Coverage must not drop.

## Notes
- Keep the same number of `it` cases and the same described behavior. This is a pure assertion-style refactor.
- The class-plus-text replacement for the exact matches no longer catches extra markup around the alert. The user accepted this trade-off during refinement.
