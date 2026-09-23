# Controller: Map-based public patchRow
Rename the private `#patchRowState(uuid, patch)` to a public `patchRow(uuid, patch)`, and rewrite its updater to work on a `Map`:

```js
patchRow(uuid, patch) {
  this.setRowState((current) => new Map(current).set(uuid, { ...current.get(uuid), ...patch }));
}
```

`#performRowAction` calls `this.patchRow(...)` in place of `#patchRowState`. Update the JSDoc: the constructor's `setRowState` now holds a `Map` keyed by request uuid, and `patchRow` gets a public-method doc stating that it preserves the row's other fields.

In the spec, change the `itBehavesLikeRowAction` fixtures and expectations to `Map`s. For example, `updater(new Map())` should equal `new Map([['req-uuid', { error: null }]])`, and `rowStateBefore`/`rowStateAfter` become `Map`s. Add a `#patchRow` describe block that checks three things: the updater merges the patch into an existing row and keeps its other fields, it creates a missing row, and it returns a new `Map` without mutating the input.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js` — public Map-based `patchRow`, used by `#performRowAction`.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsControllerSpec.js` — Map fixtures/expectations and new `#patchRow` specs.
