# Add AdminClient

New file `frontend/assets/js/client/AdminClient.js`, following `AccountsClient`'s static-methods
class style, built on the shared `ApiClient`. No `GET` support exists on `ApiClient` today (its
`#request` helper always attaches a JSON body, which `fetch` rejects on `GET`), and the backend
plan's user-search endpoint is deliberately `POST /admin/users/search.json` for exactly this
reason — so every method here is a plain `ApiClient.postJson` call, no `ApiClient` changes needed.

- `static async searchUsers(q)` — `ApiClient.postJson('/admin/users/search.json', { q })`.
- `static async generateRecoveryLink(userId)` — `ApiClient.postJson(
  \`/admin/users/${userId}/recovery-link.json\`, {})`.
- `static async sendRecoveryEmail(userId)` — `ApiClient.postJson(
  \`/admin/users/${userId}/send-recovery-email.json\`, {})`.

## Files to Change

- `frontend/assets/js/client/AdminClient.js` — new file.
- `frontend/specs/assets/js/client/AdminClientSpec.js` (mirroring
  `frontend/specs/assets/js/client/AccountsClientSpec.js`'s path/style) — new spec, mocking
  `ApiClient` the same way.
