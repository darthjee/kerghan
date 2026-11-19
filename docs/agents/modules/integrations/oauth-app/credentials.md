# OAuth App: credentials

Part of the [OAuth App type](../oauth-app.md). Required scopes, validate/create, secret payload and metadata shapes, expiry, test connection, `invalid` reason codes and the `secretHint` format.

## Required scopes

- Request and require **`repo`** only, for the same reason as classic PATs: private
  repositories need it ([PAT](../pat.md#classic-tokens)).
- Granted scopes are read from the `X-OAuth-Scopes` header of `GET /user` made with the new
  token, parsed like a PAT's (split on `,`, trimmed, empty entries dropped). The `scope` field of
  the token response is not trusted on its own.
- Without `repo`:
  - callback fails with **422** `INTEGRATION_INSUFFICIENT_PERMISSIONS` (counted toward the
    cool-off), and the new token is revoked;
  - test connection sets `invalid` + `insufficient_permissions`.
- **Warning** (also shown in the UI): `repo` also grants **write** access to every
  repository the user can reach. Kerghan only reads, but the token can do more.
- Organizations with OAuth App access restrictions only expose their private repositories once
  an owner approves Kerghan's app. That doesn't fail validation; the UI mentions it.

## Validate / create

`validate` runs on callback, through the shared, injectable GitHub client
([security](../security.md#faking-github-in-tests)), with two GitHub calls.

1. **Code exchange:** `POST https://github.com/login/oauth/access_token` with
   `Accept: application/json` and `client_id`, `client_secret`, `code`, `redirect_uri` and
   `code_verifier`. On success GitHub answers
   `{ "access_token": "gho_…", "token_type": "bearer", "scope": "repo" }`. The token is wrapped
   in a `Secret` immediately. GitHub reports exchange errors as a **200** with an `error` field.
2. **Identity and scopes:** `GET /user` with `Authorization: Bearer <token>`: `login` gives
   `githubLogin`, `X-OAuth-Scopes` gives the scopes.

Then it applies the `repo` check and returns the secret payload, `githubLogin`, `expiresAt`
(`null`) and `metadata`.

Error mapping (callback):

| GitHub answer | Error | Counted toward the cool-off |
|---|---|---|
| Exchange: `error` = `bad_verification_code` (unknown, expired or already used code) | 422 `INTEGRATION_CREDENTIAL_INVALID` | yes |
| Exchange: any other `error` (e.g. `incorrect_client_credentials`, `redirect_uri_mismatch`), or a 200 without an `access_token` starting with `gho_` | 502 `GITHUB_UNAVAILABLE`; logged at error level with GitHub's `error` code only, since it means server misconfiguration | no |
| `GET /user`: 401 | 422 `INTEGRATION_CREDENTIAL_INVALID` | yes |
| `GET /user`: 200 without `repo` | 422 `INTEGRATION_INSUFFICIENT_PERMISSIONS` | yes |
| Either call: 403 or 429 with `x-ratelimit-remaining: 0` or a `retry-after` header | 503 `GITHUB_RATE_LIMITED` (+ `Retry-After`, as for PATs) | no |
| Either call: network error, timeout, 5xx, any other unexpected status, or a 200 `GET /user` without a usable `login` | 502 `GITHUB_UNAVAILABLE` | no |

Any of these failures after a token was obtained triggers the best-effort revocation of that
token ([Callback](flow.md#callback)).

## Secret payload shape

The plaintext JSON encrypted into `secret_ciphertext`
([data model](../data-model.md#storage-model)):

```json
{ "token": "gho_…" }
```

- Only the access token. There is no refresh token (see [Expiry](#expiry)).
- When decrypted, the payload is validated against the same shape (`token` a string starting
  with `gho_`). A payload that doesn't match is handled like a decryption failure
  (`undecryptable`).

## Metadata shape

```json
{
  "scopes": ["repo"],
  "clientId": "Ov23liAbCdEf01234567"
}
```

| Field | Type | Rules |
|---|---|---|
| `scopes` | array of strings | The scopes from `X-OAuth-Scopes`, sorted and de-duplicated (at most 50 entries of at most 64 characters each). |
| `clientId` | string | The OAuth App client id the token was issued to: 1–100 characters of `[A-Za-z0-9._-]`. Public by nature (it is in every authorize URL). |

`describeMetadata` validation:

- Exactly these two keys; any other key is rejected.
- Wrong types or out-of-range values are rejected.
- Metadata holds **nothing usable as a credential**: no token, no fragment of it, no client
  secret, no `state` or verifier.

`clientId` lets delete know whether the configured app can still revoke the token: a token
issued to a previous app (after the client id changed) can't be revoked with the new app's
credentials.

## Expiry

- OAuth App user access tokens **don't expire**: there is **no refresh token and no refresh
  strategy**, and `expiresAt` is always `null`.
- GitHub still revokes them on its side. Per GitHub's docs, a token stops working when:
  - the user revokes Kerghan's app in their GitHub settings, which revokes **every** token of
    that app for that user, so all their `oauth_app` integrations become `invalid` on their next
    test;
  - it hasn't been used for **one year**;
  - the user authorizes the app more than **10 times with the same scopes**: GitHub then
    revokes the oldest token. A user holding more than 10 `oauth_app` integrations for the same
    GitHub account therefore loses the oldest one. The UI mentions this limit;
  - an organization or GitHub itself revokes it (e.g. a leaked token).
- Each case shows up as a **401** on the next use, mapped to `invalid` + `revoked`
  ([Test connection](#test-connection)).

## Test connection

`test(secret, current)` calls `GET /user` with the token and maps the answer:

| GitHub answer | Outcome |
|---|---|
| 200 with `repo` | `active`, with refreshed `githubLogin` and `metadata` (`expiresAt` stays `null`) |
| 200 without `repo` | `invalid` + `insufficient_permissions` |
| 401 | `invalid` + `revoked` |
| Rate limit (as in [Validate / create](#validate--create)) | transient `rate_limited` (+ `retryAfterSeconds`) |
| Network error, timeout, 5xx, any other unexpected status | transient `unavailable` |

- The outcome is never `expired`, since `expiresAt` is never known.
- Test needs neither the client id nor the secret, so it keeps working when the type is
  disabled.
- Transient outcomes leave the status unchanged ([data model](../data-model.md#transitions)).

## `invalid` reason codes

| Code | When | UI text |
|---|---|---|
| `revoked` | GitHub answers 401: the app was revoked, the token was unused for a year or replaced by newer authorizations, or it was revoked by GitHub or an organization. | "GitHub no longer accepts this authorization. It may have been revoked on GitHub, unused for a year, or replaced by newer authorizations. Reconnect to fix it." |
| `insufficient_permissions` (generic) | The token no longer has the `repo` scope. | "This authorization lacks the `repo` scope. Reconnect with GitHub to grant it." |

## `secretHint` format

The `gho_` prefix, an ellipsis (`…`, U+2026) and the **last 4 characters** of the token, e.g.
`gho_…a1b2` (9 characters, well within the 64-character limit). It never includes more of the
token than the prefix and the last 4 characters.

