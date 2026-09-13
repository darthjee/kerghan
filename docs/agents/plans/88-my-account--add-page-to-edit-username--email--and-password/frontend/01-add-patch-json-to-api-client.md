# Add patchJson to ApiClient

`ApiClient.js` currently only exposes `postJson`/`deleteJson` (lines 23-25, 36-38), both thin
wrappers around a private `#sendJson(method, path, body)`. There is no `PATCH` helper yet, and
this issue's endpoint is `PATCH /auth/account.json`.

Add `patchJson(path, body)` mirroring the existing wrappers exactly:
```js
patchJson(path, body) {
  return this.#sendJson('PATCH', path, body);
}
```

## Files to Change
- `frontend/assets/js/client/ApiClient.js` — add `patchJson`, mirroring `postJson`/`deleteJson`.
