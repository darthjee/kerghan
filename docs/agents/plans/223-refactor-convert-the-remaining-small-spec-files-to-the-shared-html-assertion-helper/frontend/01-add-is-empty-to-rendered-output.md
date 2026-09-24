# Add isEmpty() to renderedOutput
Add an `isEmpty()` query to the object that `renderedOutput(element)` returns. It returns `true` when the rendered markup is the empty string (`rendered === ''`), and `false` otherwise. Specs can then assert that a component renders nothing without comparing against a markup literal.

- Add `isEmpty: () => rendered === ''` next to the existing queries.
- Update the JSDoc: mention `isEmpty` in the `@description`, and add it to the `@returns` type (`isEmpty: Function`) and to the prose ("whose `isEmpty()` tells whether nothing was rendered").
- Add a `describe('#isEmpty', ...)` block to `renderedOutputSpec.js`, following the existing blocks:
  - true for an element that renders nothing (e.g. a small component function returning `null`)
  - false for an element that renders markup (e.g. the fixture element the spec already uses)

## Files to Change
- `frontend/specs/support/renderedOutput.js`: add `isEmpty()` and its JSDoc.
- `frontend/specs/support/renderedOutputSpec.js`: add `#isEmpty` cases.
