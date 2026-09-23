# Add containsElement to renderedOutput
Add a third boolean query to the object returned by `renderedOutput`:

```js
containsElement: (tagName, text) => rendered.includes(`>${text}</${tagName}`),
```

This tells whether `text` is the full content of an element named `tagName`, as in `>Log in</button`. The fragment must be built inside a template literal, never a plain string literal, so the real rule doesn't flag it (the same technique as `containsTag`). Keep the internal variable named `rendered`, with no "html" in the name. Update the JSDoc `@returns` and `@description` to document the new query.

In `renderedOutputSpec.js`, add a `#containsElement` describe block that uses the existing `p.greeting` / `Hello` fixture:
- true for `containsElement('p', 'Hello')`;
- false for absent text (`containsElement('p', 'Goodbye')`);
- false for the same text under a different tag (`containsElement('span', 'Hello')`).

Also add a `containsElement` call to the existing "renders the element once" case.

## Files to Change
- `frontend/specs/support/renderedOutput.js`: add `containsElement` and update the JSDoc.
- `frontend/specs/support/renderedOutputSpec.js`: add `#containsElement` cases and extend the render-once case.
