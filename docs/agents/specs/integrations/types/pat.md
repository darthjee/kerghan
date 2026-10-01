# Integration type: Personal Access Token (`pat`)

Part of the [integrations spec](../README.md). Defines the `pat` type, following the
[type contract](../type-contract.md#what-a-type-spec-must-contain). It fills every per-type slot
the generic specs leave open.

## Overview

- The user pastes a GitHub Personal Access Token, and Kerghan stores it as an integration.
- This is the first type to be implemented. #300 ships it with the generic backend module, and
  #301 builds its create form.
- **Flow kind:** credential-paste only (see
  [Flow kind, routes and config](#flow-kind-routes-and-config)).
- GitHub's exact header names and status codes below follow GitHub's REST API docs. #300 checks
  them again against the docs when it implements the type.

## Supported tokens

Both GitHub PAT kinds are accepted. The kind is recognised **by prefix only**:

| Kind | Prefix | `tokenKind` |
|---|---|---|
| Classic | `ghp_` | `classic` |
| Fine-grained | `github_pat_` | `fine_grained` |

- Any other prefix fails validation with **400** `VALIDATION_FAILED`. This includes legacy
  40-hex tokens and other GitHub token kinds (`gho_`, `ghu_`, `ghs_`, `ghr_`). The message never
  echoes the value, e.g. "credential.token must be a GitHub personal access token".
- The UI recommends **fine-grained** tokens, since they give least privilege (see
  [UI guidance](#ui-guidance)).

## `credential` request shape

The `credential` object of the [create envelope](../api.md#create-envelope) and of replace
credential:

```json
{ "token": "ghp_…" }
```

Validation, in this order. Every message names the field, never the value
([security.md](../security.md#secrets-never-logged)):

- `credential` is an object with exactly one key, `token`. **Unknown credential fields are
  rejected** (400 `VALIDATION_FAILED`), so nothing unexpected is ever encrypted.
- `token` is a string. Leading and trailing whitespace is trimmed (pasting often adds it).
- After trimming, `token` is 1–255 characters long.
- `token` only contains `[A-Za-z0-9_]`.
- `token` starts with `ghp_` or `github_pat_` (see [Supported tokens](#supported-tokens)).

Right after validation, the trimmed token is wrapped in a `Secret`. It only leaves the `Secret`
at the GitHub client call site and at the encryption boundary.

## Secret payload shape

The plaintext JSON that gets encrypted into `secret_ciphertext`
([model.md](../model.md#storage-model)):

```json
{ "token": "<trimmed token>" }
```

- Nothing else is stored in the secret: the kind, scopes and login are non-secret and live in
  `metadata` and `github_login`.
- When decrypted, the payload is validated against the same shape before use. A payload that
  doesn't match is handled like a decryption failure (`undecryptable`).

## Metadata shape

```json
{
  "tokenKind": "classic",
  "scopes": ["repo", "read:org"],
  "permissionsVerified": true
}
```

| Field | Type | Rules |
|---|---|---|
| `tokenKind` | string | `classic` or `fine_grained`; derived from the prefix. |
| `scopes` | array of strings, or `null` | Classic: the scopes parsed from `X-OAuth-Scopes`, sorted and de-duplicated (at most 50 entries of at most 64 characters each). Fine-grained: always `null`, since GitHub doesn't expose them. |
| `permissionsVerified` | boolean | Classic: `true` (the `repo` check ran and passed). Fine-grained: always `false`. |

`describeMetadata` validation:

- Exactly these three keys; any other key is rejected.
- `scopes` is an array when `tokenKind` is `classic`, and `null` when it is `fine_grained`.
- `permissionsVerified` is `true` for `classic` and `false` for `fine_grained`.
- Metadata holds **nothing usable as a credential**: no token, no token fragment, no `secretHint`.
  Scope names are GitHub's public scope identifiers only.

## Required scopes and permissions

### Classic tokens

- The **`repo`** scope is **required**. Private repositories are the main reason for
  integrations (#295), and a classic token needs `repo` to read them. Narrower scopes such as
  `public_repo` don't count.
- The scopes are read from the `X-OAuth-Scopes` response header of `GET /user`: a
  comma-separated list, split on `,`, each entry trimmed, empty entries dropped. A missing or
  empty header means "no scopes".
- Without `repo`:
  - create and replace credential fail with **422** `INTEGRATION_INSUFFICIENT_PERMISSIONS`,
    which counts toward the
    [failure cool-off](../security.md#create-and-replace-credential-failure-cool-off);
  - test connection sets `invalid` + `insufficient_permissions`.
- **Warning** (spec and UI): `repo` also grants **write** access to every repository the user
  can reach. Kerghan only reads, but the token can do more. The UI points to fine-grained
  tokens as the narrower option.

### Fine-grained tokens

- GitHub doesn't expose a fine-grained token's permissions, so **only the identity is
  validated**: `GET /user` must succeed.
- The metadata records the permissions as unverified (`scopes: null`,
  `permissionsVerified: false`). Create and test never fail with
  `INTEGRATION_INSUFFICIENT_PERMISSIONS` / `insufficient_permissions` for a fine-grained token.
- The UI tells the user to grant **Issues: read** and **Metadata: read** on the repositories
  they want Kerghan to see.
- A missing permission only shows up when the token is used later. That use (the backend
  proxy) is out of scope for #295.

## Validate / create

`validate(secret)` makes **one** GitHub call, `GET /user`, through the shared, injectable GitHub
client ([security.md](../security.md#faking-github)), sending the token as
`Authorization: Bearer <token>`.

On **200**, it captures:

- `githubLogin`: the `login` field of the response body.
- `tokenKind`: from the prefix.
- `scopes`: classic only, from `X-OAuth-Scopes` (see [Classic tokens](#classic-tokens)).
- `expiresAt`: see [Expiry](#expiry).

Then it applies the permission check: a classic token without `repo` is rejected with
`INTEGRATION_INSUFFICIENT_PERMISSIONS`. Otherwise it returns the secret payload, `githubLogin`,
`expiresAt` and `metadata`; the generic code encrypts and stores them.

Error mapping (create and replace credential):

| GitHub answer | Error | Counted toward the cool-off |
|---|---|---|
| 401 (bad, revoked, deleted or expired token) | 422 `INTEGRATION_CREDENTIAL_INVALID` | yes |
| 200, classic token without `repo` | 422 `INTEGRATION_INSUFFICIENT_PERMISSIONS` | yes |
| 403 or 429 with `x-ratelimit-remaining: 0` or a `retry-after` header (primary or secondary rate limit) | 503 `GITHUB_RATE_LIMITED` (+ `Retry-After` from `retry-after`, or from `x-ratelimit-reset`) | no |
| Network error, timeout, 5xx | 502 `GITHUB_UNAVAILABLE` | no |
| Any other unexpected status, or a 200 without a usable `login` | 502 `GITHUB_UNAVAILABLE` | no |

Payload validation failures (400 `VALIDATION_FAILED`) happen before any GitHub call and are not
counted either.

## Expiry

- `expiresAt` comes from GitHub's **`github-authentication-token-expiration`** response header
  on `GET /user`, e.g. `2026-11-01 00:00:00 UTC` (GitHub may also send a numeric offset such as
  `-0800`). It is parsed and stored in UTC.
- When the header is absent, the token has no expiry and `expiresAt` is `null`.
- An unparseable header is treated as absent (`null`), and a warning is logged with safe fields
  only.
- It is refreshed on every successful validate (create, replace) and every `active` test.
- The generic computed-on-read rule then reports an `active` row past `expiresAt` as `expired`
  ([model.md](../model.md#expiry)).

## Test connection

`test(secret, current)` calls `GET /user` again and maps the answer:

| GitHub answer | Outcome |
|---|---|
| 200, fine-grained, or classic with `repo` | `active`, with refreshed `githubLogin`, `expiresAt` and `metadata` |
| 200, classic without `repo` | `invalid` + `insufficient_permissions` |
| 401 and `current.expiresAt` is known and in the past | `expired` |
| Any other 401 | `invalid` + `bad_credentials` |
| Rate limit (as in [Validate / create](#validate--create)) | transient `rate_limited` (+ `retryAfterSeconds`) |
| Network error, timeout, 5xx, any other unexpected status | transient `unavailable` |

GitHub answers 401 to both an expired and a revoked token. The stored `expiresAt` is what tells
them apart; a token revoked after its expiry date still reads as `expired`, which is accurate
enough, since the fix (replace the credential) is the same.

Transient outcomes leave the status unchanged ([model.md](../model.md#transitions)).

## `invalid` reason codes

| Code | When | UI text |
|---|---|---|
| `bad_credentials` | GitHub answers 401 and the token is not known to be expired: revoked, deleted, or regenerated. | "GitHub rejected this token. It may have been revoked or deleted. Replace it with a new token." |
| `insufficient_permissions` (generic) | A classic token no longer has the `repo` scope. | "This classic token lacks the `repo` scope. Replace it with a token that has `repo`, or with a fine-grained token." |

## `secretHint` format

The known prefix, an ellipsis (`…`, U+2026) and the **last 4 characters** of the token:

- Classic: `ghp_…a1b2`.
- Fine-grained: `github_pat_…a1b2`.

The longest hint is 16 characters, well within the 64-character limit. It never includes more of
the token than the prefix and the last 4 characters.

## Flow kind, routes and config

- **Credential-paste only** (`flows: { credentialPaste: true, redirect: false }`). It uses the
  generic create (`POST /integrations.json`) and replace-credential
  (`POST /integrations/:uuid/credential.json`) routes ([api.md](../api.md#routes)).
- **No type-owned routes, no callbacks.** The checklist item on type-owned route access
  therefore doesn't apply: every route the type uses is a generic one, already covered by
  [security.md's access rules](../security.md#access-rules) and cache class `never`.
- **No env vars and no app credentials.**

## Behaviour on delete

- **Nothing happens on GitHub.** `onDelete` makes no GitHub call: GitHub offers no API for a
  third party to revoke a user's PAT. Kerghan only forgets the token (the row is deleted).
- This applies to integration delete and to owner deletion alike. An `undecryptable` row is
  deleted the same way.
- The UI reminds the user to **revoke the token on GitHub** if they no longer need it (see
  [UI guidance](#ui-guidance)).

## Error cases

Summary of the generic error codes ([api.md](../api.md#error-codes)) this type produces:

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Bad `credential` shape, unknown credential field, length, charset, or an unknown prefix. |
| `INTEGRATION_CREDENTIAL_INVALID` | 422 | GitHub answers 401 on create or replace. |
| `INTEGRATION_INSUFFICIENT_PERMISSIONS` | 422 | A classic token without `repo`, on create or replace. |
| `GITHUB_UNAVAILABLE` | 502 | Network error, timeout, 5xx or an unexpected answer, on create, replace or test. |
| `GITHUB_RATE_LIMITED` | 503 | GitHub's rate limit, on create, replace or test. |

`INTEGRATION_FLOW_UNSUPPORTED` never applies to `pat`, since it supports credential-paste.

## UI guidance

For #301's create and replace-credential forms (on top of the generic
[credential input rules](../ui.md#credential-input-rules)):

- **Fields:** *Label* (plain text) and *Token* (`type="password"`, `autocomplete="off"`).
- **Link** to GitHub's token settings (`https://github.com/settings/personal-access-tokens`
  for fine-grained, `https://github.com/settings/tokens` for classic).
- **Recommendation:** use a fine-grained token, granting *Issues: read* and *Metadata: read* on
  the repositories to monitor.
- **Classic warning:** a classic token needs the `repo` scope, which also grants write access.
- **Remove confirmation:** reminds the user that Kerghan only forgets the token, and that they
  should revoke it on GitHub if they no longer need it.
- The type picker's one-line description: "Paste a GitHub personal access token (classic or
  fine-grained)."

## Required tests

Unit specs for the PAT strategy, against the fake GitHub client
([security.md](../security.md#faking-github)). Each one submits a recognisable **canary token**
and asserts it never appears in logger calls, thrown errors, error bodies, API responses, the
stored `metadata` or the `secretHint` beyond its last 4 characters.

- **Credential validation:** a valid classic and a valid fine-grained token pass; surrounding
  whitespace is trimmed; an unknown prefix (`gho_`, a legacy 40-hex token), an empty or too long
  token, a bad character, a non-string and an unknown credential field each fail with
  `VALIDATION_FAILED`, with a message not containing the value.
- **Validate:**
  - classic with `repo` → success with `tokenKind: classic`, the parsed scopes and
    `permissionsVerified: true`;
  - classic without `repo` (including `public_repo` only and an empty `X-OAuth-Scopes`) →
    `INTEGRATION_INSUFFICIENT_PERMISSIONS`;
  - fine-grained → success with `scopes: null` and `permissionsVerified: false`, whatever
    the headers;
  - 401 → `INTEGRATION_CREDENTIAL_INVALID`;
  - rate limit (403 and 429) → `GITHUB_RATE_LIMITED` with the retry delay; 5xx, network error
    and an unexpected status → `GITHUB_UNAVAILABLE`.
- **Expiry:** the header present (UTC and numeric-offset forms) sets `expiresAt`; absent or
  unparseable gives `null`.
- **Test:** each row of the [Test connection](#test-connection) table, including 401 with a past
  `expiresAt` (`expired`), 401 with a future or `null` `expiresAt` (`bad_credentials`), and a
  classic token that lost `repo` (`insufficient_permissions`).
- **Metadata:** `describeMetadata` accepts both valid shapes and rejects an extra key, a
  mismatched `scopes`/`permissionsVerified` for the kind, and a wrong type.
- **Mask:** `ghp_…` and `github_pat_…` plus the last 4 characters.
- **Delete:** `onDelete` makes no GitHub call, for a decryptable and for an `undecryptable`
  (`secret: null`) row.

## Manual smoke check (#300)

In the running app, with real throwaway tokens:

1. Create a `pat` integration with a **classic** token that has the `repo` scope: it is
   `active`, shows `ghp_…<last 4>`, the right login, its scopes and its expiry (or "no expiry").
2. Create one with a **fine-grained** token: it is `active` with `github_pat_…<last 4>` and
   unverified permissions.
3. Try a classic token **without** `repo`: rejected with `INTEGRATION_INSUFFICIENT_PERMISSIONS`,
   nothing stored.
4. Test connection on both: still `active`. Revoke one on GitHub and test again: `invalid` with
   the `bad_credentials` text.
5. Replace the revoked one's credential with a new token: back to `active`, new hint.
6. Delete both: the rows are gone, and nothing changed on GitHub (the tokens still exist there).
7. Check the backend logs: no token value appears anywhere.
