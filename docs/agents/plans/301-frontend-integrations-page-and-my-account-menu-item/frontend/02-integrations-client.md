# IntegrationsClient
Add `client/IntegrationsClient.js`, following `AccountsClient`/`AdminClient`: a plain object of async methods over `ApiClient`, documented with JSDoc. Like the others, it returns `undefined` on a session-expired `401`.

- `listMine()`: `POST /integrations/mine.json`, resolves `{ integrations }`.
- `listTypes()`: `POST /integrations/types.json`, resolves `{ types }`.
- `create({ label, type, credential })`: `POST /integrations.json` with `provider: 'github'`.
- `rename(uuid, label)`: `PATCH /integrations/:uuid.json`.
- `replaceCredential(uuid, credential)`: `POST /integrations/:uuid/credential.json`.
- `test(uuid)`: `POST /integrations/:uuid/test.json`.
- `remove(uuid)`: `DELETE /integrations/:uuid.json` (204).

Encode `uuid` in paths (`encodeURIComponent`). Never log or persist the credential.

Specs: one spec file asserting each method's method, path and body, and that errors propagate as `ApiError`.

## Files to Change
- `frontend/assets/js/client/IntegrationsClient.js`: new client.
- `frontend/specs/assets/js/client/IntegrationsClientSpec.js`: specs.
