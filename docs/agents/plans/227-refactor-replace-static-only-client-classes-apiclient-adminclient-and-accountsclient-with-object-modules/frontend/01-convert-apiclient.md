# Convert ApiClient to an object module
Rewrite `frontend/assets/js/client/ApiClient.js` as a plain object module:

- Move the private static methods to non-exported module-level functions, preserving logic
  exactly: `sendJson(method, path, body, isRetry = false)`, `handleUnauthorized(method, path,
  body)`, `request(method, path, body)`, `parseBody(response)`, `sessionExpired()`. Replace
  `ApiClient.#x(...)` calls with direct `x(...)` calls between them.
- Declare `const ApiClient = { async postJson(path, body) {...}, async deleteJson(path, body)
  {...}, async patchJson(path, body) {...} };` with each method delegating to `sendJson`, then
  `export default ApiClient;`.
- Keep `REFRESH_PATH` and the imports unchanged.
- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment block.
- Keep the JSDoc; update `{@link ApiClient.#handleUnauthorized}`-style references to name the
  module-level functions (e.g. `{@link handleUnauthorized}`), and move the class-level JSDoc
  onto the `ApiClient` object.

Behaviour to preserve: 401 → one refresh via `AuthSession` + retry; retried 401 or failed/missing
refresh → `sessionExpired()` (clear `AuthSession`, `LoginModalEvents.open('password')` when
`window` exists, return `undefined`); 204/empty body → `{}`; other non-OK → `ApiError`.

## Files to Change
- `frontend/assets/js/client/ApiClient.js` — class → object module + module-level private functions.
