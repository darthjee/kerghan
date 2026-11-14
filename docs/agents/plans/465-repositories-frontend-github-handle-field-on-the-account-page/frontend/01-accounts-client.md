# AccountsClient: read and handle-only update

Add two methods to `AccountsClient`, with JSDoc in the file's style:

- `getMyAccount()` → `ApiClient.postJson('/auth/account/mine.json', {})`, resolving to `{ username, email, githubHandle }`.
- `updateGithubHandle(githubHandle)` → `ApiClient.patchJson('/auth/account.json', { githubHandle })`. The body has **only** `githubHandle` (a string, or `null` to clear), and never `currentPassword`.

Leave `updateAccount` unchanged, so the main form can never send `githubHandle`. Update its JSDoc return type to mention the extra `githubHandle` field in the response.

Specs (client layer, with `fetchSequence`): method, URL and exact body for both calls (`null` is sent as `null`). An error answer rejects with `ApiError` carrying `error.message`. A spec asserts that `updateAccount` never puts `githubHandle` in its body, even when the caller passes one.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — add `getMyAccount` and `updateGithubHandle`.
- `frontend/specs/assets/js/client/AccountsClientGithubHandleSpec.js` (new) — client specs for the two calls, plus the `updateAccount` no-handle assertion.
