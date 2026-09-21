# Use the helpers in ApiClientSpec
Delete the inline `fakeResponse`/`fetchSequence` definitions from `ApiClientSpec.js` and import them from the new support module. Rewrite the four `401 handling` tests so each one reads as `stubRefreshFlow([...responses])`, the `ApiClient.postJson(...)` call, its distinctive expectations (returned data, `fetch` call count, `AuthSession.set` argument, refresh URL) and `expectSessionExpired()` where applicable. The `.postJson`/`.deleteJson`/`.patchJson` tests keep using `fetchSequence` directly via the import. Assertions must not change: same expected values and call counts as today.

## Files to Change
- `frontend/specs/assets/js/client/ApiClientSpec.js` — import the shared helpers, drop the inline ones, shorten the `401 handling` tests.
