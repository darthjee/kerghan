# Add containsAttribute to renderedOutput
Add `containsAttribute: (name, value) => rendered.includes(`${name}="${value}"`)` to the object `renderedOutput` returns, alongside `contains`, `containsTag` and `containsElement`. Extend the JSDoc (`@description`, `@returns`) to document it, the same way #218 documented `containsElement`.

In `renderedOutputSpec.js`, add a `#containsAttribute` block using the existing `<p className="greeting">` fixture:
- `containsAttribute('class', 'greeting')` is true.
- `containsAttribute('class', 'farewell')` is false.
- `containsAttribute('id', 'greeting')` is false (right value, wrong attribute).

Also add a `containsAttribute` call to the "renders the element once" case.

## Files to Change
- `frontend/specs/support/renderedOutput.js` — add `containsAttribute` and its JSDoc.
- `frontend/specs/support/renderedOutputSpec.js` — add a `#containsAttribute` describe block and include the new query in the render-once case.
