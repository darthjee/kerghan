# Issue: Refactor: Convert FormFieldsHelperSpec.js to the shared HTML-assertion helper

## Description
`frontend/specs/assets/js/components/common/forms/helpers/FormFieldsHelperSpec.js` calls `renderToStaticMarkup` directly and checks the rendered strings with `toContain`/`toBe` against HTML literals (e.g. `'<div class="invalid-feedback">is required</div>'`, `'<div class="alert alert-danger">Boom</div>'`).

## Problem
Codacy reports 17 High findings (`xss/no-mixed-html`) in this file, all caused by passing HTML markup strings around in assertions.

Both dependencies are already merged:
- **#216** added the shared helper `frontend/specs/support/renderedOutput.js` (`contains`, `containsTag`, `containsElement`, `containsAttribute`, `containsInOrder`).
- **#214** refactored `FormFieldsHelper` internals without changing its rendered output.

## Expected Behavior
- Same test cases, checking the same behavior, all passing.
- No `renderToStaticMarkup` import and no HTML-literal strings left in the spec.
- The file follows the same style as the specs already converted (#219, #220, #221), e.g. `AccountEditFormHelperSpec.js`.

## Solution
Rewrite the spec to use `renderedOutput(...)` from `frontend/specs/support/renderedOutput.js`. The `render` helper returns the `renderedOutput` object, and assertions become boolean checks with `.withContext(...)`:

- `for="..."`, `id="..."`, `type="..."`, `value="..."` → `containsAttribute(name, value)`.
- `'>Username</label>'` → `containsElement('label', 'Username')`.
- `is-invalid` / `invalid-feedback` presence and absence → `contains(...)`. The error text goes through `containsElement('div', 'is required')`, and the `invalid-feedback` class through `containsAttribute('class', 'invalid-feedback')`.
- Exact `toBe('<div class="alert alert-...">...</div>')` checks for `.renderSubmitError` / `.renderSuccess` → `containsAttribute('class', 'alert alert-danger'|'alert alert-success')` plus `containsElement('div', <message>)`.
- Keep the null-return cases and the element-level test (`element.key`, the `onChange` wiring) as they are. They don't render markup.

This is a spec-only change, owned by the `frontend` agent. No production code changes.

## Benefits
Removes 17 High `xss/no-mixed-html` findings from one file, and brings this spec in line with the rest of the converted suite.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
