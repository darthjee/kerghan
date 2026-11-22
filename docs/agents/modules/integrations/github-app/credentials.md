# GitHub App: credentials and verification

Part of the [GitHub App type](../github-app.md). The user token, permissions, validation, secret and metadata shapes, expiry, token cache, test connection and reason codes.

## User token

The user-to-server token obtained in callback step 8 only proves who the user is on GitHub and
which installations they can access.

- It is wrapped in a `Secret` immediately, used for the `GET /user` and
  `GET /user/installations` calls, and then revoked: `DELETE
  https://api.github.com/applications/{client_id}/token` with HTTP Basic
  `client_id:client_secret` and body `{ "access_token": "<token>" }`.
- The revocation is **best-effort**: any failure is logged at warn level with safe fields only
  (user id, GitHub status) and otherwise ignored. It runs on every path once a token was
  obtained, success or failure.
- If GitHub also returns a `refresh_token` (apps with expiring user tokens), it is dropped
  unused. It is useless without the client secret.
- Neither token is ever stored, logged, returned or put in an error message.

## Required permissions

- The app is registered with exactly **Issues: write** and **Metadata: read** (repository
  permissions), and nothing else: no organization or account permission. Issues: write is what
  the issue push (`IntegrationsGithubIssueWriter.updateIssue`) needs; reads mint with
  `issues: read`, the push with `issues: write`
  ([issues](../github-service/issues.md#github-app-token-permissions)).
- **Operator action:** the registered app must be updated on GitHub to Issues: write, and each
  installation owner must accept the new permission. Installations still on `issues: read` are
  accepted as before, and their pushes answer `forbidden`.
- An installation is accepted only if its `permissions` object (from
  `GET /app/installations/{id}`) has `issues` and `metadata` each set to `read` or `write`.
  `write` is accepted and recorded as-is in `metadata.permissions`.
- When the app's permissions change, GitHub asks each installation's owner to accept the new
  ones; until they do, the installation keeps the old set. A missing permission therefore means
  an installation that hasn't accepted an update.
- Without both:
  - callback and select fail with **422** `INTEGRATION_INSUFFICIENT_PERMISSIONS` (counted toward
    the cool-off);
  - test connection sets `invalid` + `insufficient_permissions`.
- `repository_selection` (`all` or `selected`) is recorded, never enforced: an installation on
  selected repositories is valid; it just sees fewer repositories.

## Validate / create

Runs on callback (and select, from step 3), through the shared, injectable GitHub client
([security](../security.md#faking-github-in-tests)). There is no `validate(secret)` call on
a pasted value: the strategy exposes the steps below to the type-owned routes, which end with
the generic storage code, as the [type contract](../type-contract.md#flow-kind) requires.

1. **Code exchange:** `POST https://github.com/login/oauth/access_token` with
   `Accept: application/json` and `client_id`, `client_secret`, `code` and `redirect_uri`. On
   success GitHub answers `{ "access_token": "ghu_…", "token_type": "bearer", … }`. GitHub
   reports exchange errors as a **200** with an `error` field.
2. **Verified installations:** with `Authorization: Bearer <user token>`:
   - `GET /user`: `login` is the verifying GitHub user (`metadata.verifiedBy`).
   - `GET /user/installations?per_page=100`, following `Link: rel="next"` up to **10** pages.
     Only entries whose `app_id` equals `KERGHAN_GITHUB_APP_ID` are kept.
3. **Installation checks**, with an app JWT ([App JWT](#app-jwt)):
   `GET /app/installations/{installation_id}`. It gives the account (`account.login`,
   `account.type`), `app_id` (must equal the configured app id), `permissions`,
   `repository_selection` and `suspended_at`. The permission check applies here.
4. **Private key proof:** `POST /app/installations/{installation_id}/access_tokens` with the app
   JWT. A 201 proves the installation can actually be used; the returned installation token
   (`ghs_…`) is dropped immediately, never stored.

Then it returns the secret payload, `githubLogin` (the installation's `account.login`),
`expiresAt` (`null`) and `metadata`.

Error mapping (callback and select):

| GitHub answer | Error | Counted toward the cool-off |
|---|---|---|
| Exchange: `error` = `bad_verification_code` (unknown, expired or already used code) | 422 `INTEGRATION_CREDENTIAL_INVALID` | yes |
| Exchange: any other `error` (e.g. `incorrect_client_credentials`, `redirect_uri_mismatch`), or a 200 without an `access_token` starting with `ghu_` | 502 `GITHUB_UNAVAILABLE`; logged at error level with GitHub's `error` code only (server misconfiguration) | no |
| `GET /user` or `GET /user/installations`: 401 | 422 `INTEGRATION_CREDENTIAL_INVALID` | yes |
| Claimed or selected installation not among the verified ones; or no installation at all in connect mode | 422 `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`, with the same message whether it doesn't exist, belongs to someone else, or belongs to another app | yes |
| `GET /app/installations/{id}`: 404, or a different `app_id` (the installation vanished between steps) | 422 `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` | yes |
| `GET /app/installations/{id}`: missing `issues` or `metadata` read | 422 `INTEGRATION_INSUFFICIENT_PERMISSIONS` | yes |
| `GET /app/installations/{id}`: `suspended_at` set; or token mint answers 403 | 422 `INTEGRATION_INSTALLATION_SUSPENDED` | yes |
| Any app-JWT call: 401 (the app id, client id or key is wrong) | 502 `GITHUB_UNAVAILABLE`; logged at error level as an app misconfiguration, with no JWT or key material | no |
| Any call: 403 or 429 with `x-ratelimit-remaining: 0` or a `retry-after` header | 503 `GITHUB_RATE_LIMITED` (+ `Retry-After`, as for PATs) | no |
| Any call: network error, timeout, 5xx, any other unexpected status, or a 200 without the expected fields | 502 `GITHUB_UNAVAILABLE` | no |

- The rate-limit row takes precedence over the 403 rows: a 403 is a rate limit only with the
  headers above.
- More than 10 pages of installations (over 1000) → only those pages are considered; a claimed
  installation beyond them answers `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`. The truncation is
  logged at warn level.
- The suspended case gets its own code, rather than `INTEGRATION_CREDENTIAL_INVALID`, because
  the user can fix it on GitHub and the UI must tell them how.

### App JWT

- Signed **RS256** with the private key ([Server config](config-and-proxy.md#server-config)); claims `iat` = now
  − 60 s, `exp` = now + 9 min (GitHub's maximum is 10), `iss` = the app's **client id** (GitHub
  accepts the client id or the app id; the client id is its current recommendation).
- Minted per use, kept only in memory for that call, never logged, stored or returned.
- Signing uses Node's `crypto` (`sign` with SHA-256, in `github-app-jwt.ts`); no JWT library
  and no hand-rolled signature code beyond what `crypto` provides.

## Secret payload shape

The plaintext JSON encrypted into `secret_ciphertext`
([data model](../data-model.md#storage-model)):

```json
{ "installationId": 12345678 }
```

- Only the installation id. The id isn't secret on its own, but it goes through the generic
  secret path anyway, so the generic code stays type-agnostic, and the AAD binds it to its row
  ([security](../security.md#binding-to-the-row-aad)): copying one row's ciphertext onto
  another row fails to decrypt.
- What makes it usable is the server's private key, which lives only in server config.
- When decrypted, the payload is validated against the same shape (`installationId` a positive
  integer, no other key). A payload that doesn't match is handled like a decryption failure
  (`undecryptable`).

**Never stored**, for any user: installation access tokens, the user-to-server token, its
refresh token, the app JWT, or any user-supplied app key.

## Metadata shape

```json
{
  "installationId": 12345678,
  "appId": 123456,
  "accountLogin": "acme",
  "accountType": "Organization",
  "repositorySelection": "selected",
  "permissions": { "issues": "read", "metadata": "read" },
  "verifiedBy": "octocat"
}
```

| Field | Type | Rules |
|---|---|---|
| `installationId` | integer | Positive, below 2^53. Equals the secret payload's. Shown so the owner can find it on GitHub. |
| `appId` | integer | Positive. The app id the installation belongs to. |
| `accountLogin` | string | 1–39 characters of `[A-Za-z0-9-]`, as GitHub logins. Equals `githubLogin`. |
| `accountType` | string | `User` or `Organization`. |
| `repositorySelection` | string | `all` or `selected`. |
| `permissions` | object | Exactly the keys `issues` and `metadata`, each `read` or `write`. |
| `verifiedBy` | string | The GitHub login that proved access in the flow (same rules as `accountLogin`). |

`describeMetadata` validation:

- Exactly these keys; any other key is rejected.
- Wrong types or out-of-range values are rejected.
- Metadata holds **nothing usable as a credential**: no token, no JWT, no key material, no
  client secret, no `code` or `state`.

On a successful test, every field is refreshed from GitHub except `verifiedBy`, which keeps the
value from the last callback or select.

## Identity

- `githubLogin` is the installation **account's** login (a user or an organization), which is
  what the list column shows. It is refreshed on test, so a renamed account shows its new login.
- The verifying user's login is `metadata.verifiedBy`.

## Expiry

- `expiresAt` is always `null`: an installation doesn't expire.
- Installation access tokens last **1 hour**, but they are transient: minted when needed and
  never stored in the database, so their expiry never reaches the row. Repository calls reuse a
  token from an in-memory cache ([Installation token cache](#installation-token-cache)).
- An installation stops working when it is uninstalled or suspended, or loses permissions; each
  shows up on the next test ([Test connection](#test-connection)). There are no webhooks
  (`product.md`), so nothing notices it earlier.

## Installation token cache

Repository calls made through [`IntegrationsGithubService`](../github-service.md) do not mint a token
per call:

- An installation access token is cached **in process memory only** (never in the database, a log
  or a response), per integration, until its `expires_at` minus 5 minutes; concurrent calls share
  one mint (single-flight).
- It is minted with `metadata: read` only.
- The mint failure rules (`404`/`403` set the integration `invalid`, a `401` of the app JWT is a
  server misconfiguration) are in
  [GitHub App installation tokens](../github-service/api.md#github-app-installation-tokens).
- **Test connection** still mints a fresh token and drops it, so it checks the real state.

## Test connection

`test(secret, current)` uses the app JWT only (no user token):

1. `GET /app/installations/{installationId}`.
2. If that passes, `POST /app/installations/{installationId}/access_tokens`, dropping the token.

| GitHub answer | Outcome |
|---|---|
| Both succeed, permissions present, not suspended | `active`, with refreshed `githubLogin` and `metadata` (`expiresAt` stays `null`) |
| Step 1: 404, or a different `app_id` | `invalid` + `uninstalled` |
| Step 1: `suspended_at` set | `invalid` + `suspended` |
| Step 1: missing `issues` or `metadata` read | `invalid` + `insufficient_permissions` |
| Step 2: 404 | `invalid` + `uninstalled` |
| Step 2: 403 (not a rate limit) | `invalid` + `suspended` |
| Rate limit (as in [Validate / create](#validate--create)) | transient `rate_limited` (+ `retryAfterSeconds`) |
| App-JWT 401 (misconfiguration), network error, timeout, 5xx, any other unexpected status | transient `unavailable` (the 401 also logged at error level) |

- The outcome is never `expired`.
- **When the type is disabled**, test can't sign a JWT. It answers transient `unavailable`
  without any GitHub call, so the status stays unchanged and the generic route answers 502
  `GITHUB_UNAVAILABLE`. This differs from the [OAuth App](../oauth-app/credentials.md#test-connection), whose
  test only needs the stored token. The UI avoids the case: it disables *Test* on `github_app`
  rows while the type is disabled ([When disabled](config-and-proxy.md#when-disabled)).
- Transient outcomes leave the status unchanged ([data model](../data-model.md#transitions)).

## `invalid` reason codes

| Code | When | UI text |
|---|---|---|
| `uninstalled` | GitHub no longer knows the installation (404). | "Kerghan's GitHub App is no longer installed on this account. Reinstall it and reconnect." |
| `suspended` | The installation is suspended (`suspended_at`, or a 403 when minting a token). | "This installation is suspended on GitHub. Unsuspend it in the account's GitHub settings, then test again." |
| `insufficient_permissions` (generic) | The installation lacks Issues: read or Metadata: read. | "This installation hasn't granted Issues and Metadata read access. Accept the app's requested permissions on GitHub, then test again." |

## `secretHint` format

`installation …` followed by the **last 4 digits** of the installation id (all of them if it has
fewer), e.g. `installation …5678` (17 characters, well within the 64-character limit). The id
isn't secret; the hint just follows the contract's format.
