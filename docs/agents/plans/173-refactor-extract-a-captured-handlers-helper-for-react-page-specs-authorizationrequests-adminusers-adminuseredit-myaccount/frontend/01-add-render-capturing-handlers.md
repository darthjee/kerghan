# Add renderCapturingHandlers helper
Create `frontend/specs/support/renderCapturingHandlers.js` exporting `renderCapturingHandlers(Page, Helper)`. It spies on `Helper.render` with a `callFake` that stores the second argument and returns `React.createElement('div')`, renders `React.createElement(Page)` with `renderToStaticMarkup`, and returns the captured `handlers`. It must be called from inside an `it` (it uses `spyOn`). Add JSDoc like the other support files (`@param`, `@returns`, a `@description` noting it must be called within a spec). Add a sibling `renderCapturingHandlersSpec.js` (mirrors `fakeWindowSpec.js`) covering: returns the handlers passed to `Helper.render`, and renders the page (the fake `div` ends up in the markup / `Helper.render` was called once).

## Files to Change
- `frontend/specs/support/renderCapturingHandlers.js` — new helper.
- `frontend/specs/support/renderCapturingHandlersSpec.js` — new spec for the helper.
