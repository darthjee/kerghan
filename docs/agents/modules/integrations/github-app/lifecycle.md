# GitHub App: lifecycle, access, errors and frontend

Part of the [GitHub App type](../github-app.md). Deletion, access rules, error codes and the UI.

## Behaviour on delete

- `onDelete` does **nothing on GitHub**: no uninstall, no token revocation (there is no stored
  token). Other Kerghan integrations, of this user or others, may use the same installation, and
  the installation belongs to the GitHub account, not to Kerghan.
- Only the row is deleted. This applies to integration delete and to owner deletion alike, and
  to `undecryptable` rows.
- The Remove confirmation says: "Kerghan's GitHub App stays installed on `<account>`, and other
  connections may still use it. Uninstall it on GitHub if you no longer want it."

## Access

The type-owned routes follow the checklist of the
[type contract](../type-contract.md#what-a-type-doc-must-contain):

- They require `JwtGuard` and are covered by `OriginGuard`.
- The owner comes from `req.user.sub` only. The flow is bound to the initiating user through the
  `state` row's `user_id`.
- **The installation is bound to the user only through the user-token check**
  (`GET /user/installations` with a token from a `code` that the same flow's `state` vouches
  for), or through a `select` row recording that check's result. Never through
  `installation_id` alone: a forged or guessed id is rejected with the same error as a missing
  one.
- Replace credential targets only a row found with `uuid` + `user_id` in the query, at start and
  again at callback or select; a foreign or missing row answers 404
  ([security](../security.md#access-rules)). Admins get no access to anyone else's flow.
- **Same installation, several integrations or users:** allowed and isolated
  ([data model](../data-model.md#edge-cases)). Each user proves access on their own. Nothing
  (status, error code, message, selection list) reveals that another Kerghan user holds the same
  installation.
- They are cache class `never`.
- They follow the generic logging, `Secret` and canary rules: the code, the user token, its
  refresh token, installation tokens, the app JWT, the private key, the client secret and the
  `state` never reach a logger call, an error message or a response (other than `state` inside
  `redirectUrl` or a selection).

## Error cases

Summary of the error codes
([routes](../../../backend/routes/integrations.md#error-codes)) this type produces:

| Code | Status | When |
|---|---|---|
| `NOT_FOUND` | 404 | Type disabled (start, callback, select); foreign or missing replace target (start, callback, select). |
| `VALIDATION_FAILED` | 400 | Bad start, callback or select body. |
| `INTEGRATION_FLOW_UNSUPPORTED` | 400 | Generic create or replace credential with `github_app`; start with an `integrationId` of another type. |
| `INTEGRATION_REDIRECT_STATE_INVALID` | 400 | Unknown, expired, used, foreign, wrong-stage or wrong `state` on callback or select. |
| `INTEGRATIONS_LIMIT_REACHED` | 409 | Cap reached, at start, callback or select (create). |
| `INTEGRATION_LABEL_TAKEN` | 409 | Duplicate label, at start, callback or select (create). |
| `INTEGRATION_CREDENTIAL_INVALID` | 422 | Bad code on exchange, or the user token answers 401, on callback. |
| `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` | 422 | The installation isn't among those the user can access, doesn't exist, or belongs to another app; or connect mode finds none. |
| `INTEGRATION_INSUFFICIENT_PERMISSIONS` | 422 | Installation without Issues: read and Metadata: read. |
| `INTEGRATION_INSTALLATION_SUSPENDED` | 422 | Installation suspended. |
| `INTEGRATION_CREDENTIAL_LOCKED` | 423 | Failure cool-off active, at start, callback or select. |
| `GITHUB_UNAVAILABLE` | 502 | Network error, timeout, 5xx, unexpected answer, or app misconfiguration, on callback, select or test; test while disabled. |
| `GITHUB_RATE_LIMITED` | 503 | GitHub's rate limit, on callback, select or test. |

## Frontend

On top of the generic [UI shell](../frontend.md) and the OAuth App's landing
plumbing:

- **Type picker** one-line description: "Connect a GitHub account or organization by installing
  Kerghan's GitHub App. Read-only access to issues; no token is stored."
- **Create:** a form with *Label* (plain text) and two buttons:
  - *Install on GitHub* (`mode: "install"`);
  - *Connect existing installation* (`mode: "connect"`), with the hint "Use this if the app is
    already installed on your account or organization."

  Each calls start and then navigates to `redirectUrl`. There is no credential input.
- **Replace credential:** shown as *Reconnect* on `github_app` rows, offering the same two
  choices, with no label.
- **Before continuing**, the form says: the app only asks for read access to issues and
  metadata; organization members without admin rights can't install it, but can request it or
  connect an existing installation.
- **Landing:** see [Landing](flow.md#landing). Success shows the new or updated row with "Connected to
  the GitHub App installation on `<account>`".
- **Selection:** a list of `accountLogin` (with a user or organization marker), one button each,
  which calls select. Leaving the page drops the selection; the `select` row expires.
- **Errors:** the generic error mapping, plus:
  - `INTEGRATION_REDIRECT_STATE_INVALID` → "This GitHub link expired or was already used. Start
    again.";
  - `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` → "Your GitHub account can't access that
    installation of Kerghan's GitHub App. Install it, or ask the account's owner to.";
  - `INTEGRATION_INSTALLATION_SUSPENDED` → "This installation is suspended on GitHub. Unsuspend
    it in the account's GitHub settings, then try again."
- **Row details:** account login and type, repository selection ("all repositories" or
  "selected repositories"), and "no expiry".
- **Remove confirmation:** see [Behaviour on delete](#behaviour-on-delete).
- The `code` and `state` (including a selection `state`) never reach `console`, storage,
  component state beyond the request that uses them, or the URL after `replaceState`.
