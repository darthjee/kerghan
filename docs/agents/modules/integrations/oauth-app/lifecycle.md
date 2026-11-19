# OAuth App: lifecycle

Part of the [OAuth App type](../oauth-app.md). Revocation, behaviour on delete, access, error cases and the frontend.

## Revocation

Used on delete, on replace (the previous token) and on callback failures (the new token):

- `DELETE https://api.github.com/applications/{client_id}/token`, authenticated with HTTP Basic
  `client_id:client_secret`, with body `{ "access_token": "<token>" }`. GitHub answers 204.
- It revokes **only that token**. Other `oauth_app` integrations of the same GitHub user keep
  working. Kerghan never calls `DELETE /applications/{client_id}/grant`, which would revoke the
  user's whole authorization (every token).
- It goes through the shared GitHub client, and is **best-effort**: any failure (422 for an
  already revoked or unknown token, 404, rate limit, network error, 5xx) is logged at warn level
  with safe fields only (integration uuid, user id, GitHub status) and otherwise ignored.
- It is skipped (and logged) when the type is disabled, or when the token's `metadata.clientId`
  differs from the configured client id.

## Behaviour on delete

- `onDelete` makes a best-effort [revocation](#revocation) of this integration's token, then
  the row is deleted. A failure never blocks the deletion.
- This applies to integration delete and to owner deletion alike.
- An `undecryptable` row (`secret: null`) is deleted without any GitHub call.
- The Remove confirmation says Kerghan will also try to revoke this authorization on GitHub, and
  that other connections of the same GitHub account keep working.

## Access

Both type-owned routes follow the checklist of the
[type contract](../type-contract.md#what-a-type-doc-must-contain):

- They require `JwtGuard` and are covered by `OriginGuard`.
- The owner comes from `req.user.sub` only. The GitHub redirect is bound to the initiating user
  through the `state` row's `user_id`, never through any id carried in the callback.
- Replace credential targets only a row found with `uuid` + `user_id` in the query, both at
  start and again at callback; a foreign or missing row answers 404
  ([security](../security.md#access-rules)). Admins get no access to anyone else's flow.
- They are cache class `never`.
- They follow the generic logging, `Secret` and canary rules: the code, the token, the client
  secret, the `state` and the verifier never reach a logger call, an error message or a
  response (other than `state` inside `authorizeUrl`).

## Error cases

Summary of the error codes
([routes](../../../backend/routes/integrations.md#error-codes)) this type produces:

| Code | Status | When |
|---|---|---|
| `NOT_FOUND` | 404 | Type disabled (start, callback); foreign or missing replace target (start, callback). |
| `VALIDATION_FAILED` | 400 | Bad start or callback body. |
| `INTEGRATION_FLOW_UNSUPPORTED` | 400 | Generic create or replace credential with `oauth_app`; start with an `integrationId` of another type. |
| `INTEGRATION_REDIRECT_STATE_INVALID` | 400 | Unknown, expired, used, foreign or wrong `state` on callback. |
| `INTEGRATIONS_LIMIT_REACHED` | 409 | Cap reached, at start or callback (create). |
| `INTEGRATION_LABEL_TAKEN` | 409 | Duplicate label, at start or callback (create). |
| `INTEGRATION_CREDENTIAL_INVALID` | 422 | Bad code on exchange, or `GET /user` answers 401, on callback. |
| `INTEGRATION_INSUFFICIENT_PERMISSIONS` | 422 | Token without `repo`, on callback. |
| `INTEGRATION_CREDENTIAL_LOCKED` | 423 | Failure cool-off active, at start or callback. |
| `GITHUB_UNAVAILABLE` | 502 | Network error, timeout, 5xx, unexpected answer or exchange misconfiguration, on callback or test. |
| `GITHUB_RATE_LIMITED` | 503 | GitHub's rate limit, on callback or test. |

## Frontend

On top of the generic [UI shell](../frontend.md):

- **Type picker** one-line description: "Connect a GitHub account by authorizing Kerghan's
  OAuth App."
- **Create:** a form with only *Label* (plain text) and a *Continue to GitHub* button, which
  calls start and then navigates to `authorizeUrl`. There is no credential input.
- **Replace credential:** shown as *Reconnect with GitHub* on `oauth_app` rows; it calls start
  with `integrationId`, with no form.
- **Warnings** shown before continuing: `repo` grants write access too; organizations may need
  to approve the app before their private repositories are visible; GitHub keeps at most 10
  authorizations of the app per account, so connecting the same account more than 10 times
  revokes the oldest one.
- **Landing:** see [Landing](flow.md#landing). Success shows the new or updated row with "Connected to
  GitHub as `<login>`"; errors use the generic error mapping, plus
  `INTEGRATION_REDIRECT_STATE_INVALID` → "This GitHub authorization link expired or was already
  used. Start again."
- **Remove confirmation:** see [Behaviour on delete](#behaviour-on-delete).
- The `code` and `state` never reach `console`, storage, component state beyond the single
  callback request, or the URL after `replaceState`.
