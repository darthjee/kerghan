# Add the rendered-output assertion helper
Create `frontend/specs/support/renderedOutput.js`. The name is a suggestion, but keep "html" and "markup" out of every exported and internal identifier, because the rule matches on names. Follow the style of the existing support helpers (`renderCapturingHandlers.js`): a named export with a JSDoc block.

Suggested shape:

```js
export const renderedOutput = (element) => {
  const renderedHtml = renderToStaticMarkup(element); // HTML-named, as the rule expects
  return {
    contains: (text) => renderedHtml.includes(text),
    matches: (pattern) => pattern.test(renderedHtml),
  };
};
```

- Call sites assert on the booleans, for example `expect(page.contains('<form')).withContext('form tag').toBeTrue()`. Give each one a `withContext` label so failure messages stay readable, since they no longer print the markup.
- Expose only what the call sites need. Today that is `contains` (negated with `.toBeFalse()` where the old spec used `.not.toContain`). Add `matches` only if a converted call site needs it; otherwise leave it out so coverage does not drop.
- Keep the internal storage variable HTML-named, and never pass it to a non-HTML-named function other than the `String.prototype` methods. Step 03 confirms whether this is enough.

Add `frontend/specs/support/renderedOutputSpec.js`, following the other `*Spec.js` files in `support/`. Cover:
- `contains` is true and false for present and absent text.
- The element is rendered once.
- `matches`, if it was added.

## Files to Change
- `frontend/specs/support/renderedOutput.js`: new helper.
- `frontend/specs/support/renderedOutputSpec.js`: new spec for the helper.
