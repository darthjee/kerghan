# Integration type: GitHub App installation (`github_app`)

Part of the [integrations spec](../README.md). Defines the `github_app` type, following the
[type contract](../type-contract.md#what-a-type-spec-must-contain) and its
[redirect flow invariants](../type-contract.md#redirect-flow-invariants). It fills every
per-type slot the generic specs leave open.

## Overview

- The user installs Kerghan's GitHub App on a GitHub account (theirs or an organization's), or
  connects an installation they can already access, and Kerghan stores **which installation**
  it is as an integration. No token is stored: installation access tokens are minted on demand
  from the app's private key.
- #303 implements this type (backend strategy, routes and table; frontend flow; Tent rule), on
  top of the generic module built by #300 and #301 and the redirect plumbing added by #302.
- **Flow kind:** redirect-based only (see [Flow](#flow)).
- **Server config:** optional. Without the app's id, slug, private key, client id and client
  secret the type is **disabled** (see [Server config](#server-config)).
- GitHub's exact endpoints, parameters, headers, redirect behaviour and token limits below follow
  GitHub's GitHub App and REST API docs. #303 checks them again against the docs when it
  implements the type.

### Why ownership has to be verified

The `installation_id` GitHub's redirect carries proves nothing: it is a small, sequential,
guessable number, and anyone can type it into the callback. The `state` only proves the caller
started a flow, not that they own the installation. And an app-authenticated (JWT)
`GET /app/installations/{id}` sees **every** installation of the app. With `state` alone, any
Kerghan user could start a flow, skip GitHub, and post another account's `installation_id`,
claiming that account's private repositories.

So the app enables **Request user authorization (OAuth) during installation**. The redirect then
also carries a `code`, which the backend exchanges for a user-to-server token, and the
installation is accepted only if GitHub lists it among **that user's** installations
(`GET /user/installations`). The user token is then revoked and discarded; it is never stored.

## Flow

**Redirect-based only** (`flows: { credentialPaste: false, redirect: true }`). Generic create
(`POST /integrations.json`) and replace credential (`POST /integrations/:uuid/credential.json`)
with `type: github_app`, or on a `github_app` row, answer **400** `INTEGRATION_FLOW_UNSUPPORTED`
([api.md](../api.md#create-envelope)).

Two entry points share the same callback:

- **Install** (`mode: "install"`, the default): the user goes to the app's installation page,
  installs it (or, as an account admin, reconfigures an existing installation), and GitHub
  asks them to authorize the app as part of the installation.
- **Connect existing** (`mode: "connect"`): the user only authorizes the app, without
  installing anything, and picks one of the installations GitHub says they can access. This is
  how an organization member connects an installation an owner already made, without admin
  rights on it.

### Routes

| Step | Route | Served by | Body | Success |
|---|---|---|---|---|
| Start | `POST /integrations/github_app/start.json` | backend | `{ "label": "Work", "mode": "install" }` (create) or `{ "integrationId": "<uuid>", "mode": "connect" }` (replace credential) | `200` `{ "redirectUrl": "https://github.com/…" }` |
| Landing | `GET /integrations/github_app/callback?code=…&installation_id=…&setup_action=…&state=…` | Tent, serving the frontend directly ([Proxy](#proxy-tent)) | — | the SPA's `index.html` |
| Callback | `POST /integrations/github_app/callback.json` | backend | `{ "code": "…", "state": "…", "installationId": 12345678, "setupAction": "install" }` (`installationId` and `setupAction` only when GitHub sent them) | `201` `Integration` (create), `200` `Integration` (replace), or `200` `{ "selection": … }` ([Selection](#selection)) |
| Select | `POST /integrations/github_app/select.json` | backend | `{ "state": "…", "installationId": 12345678 }` | `201` `Integration` (create) or `200` `Integration` (replace) |

- Every backend route sits behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`), is
  covered by `OriginGuard` (they are `POST`s), and is cache class `never`
  (`@CachePolicy(CacheClass.Never)` at controller level, so they send `X-Skip-Cache` and
  `Cache-Control: no-store`). None belongs in Navi's warm-up.
- The owner is always `req.user.sub`. Nothing in the body or the GitHub redirect names a user,
  and the `installation_id` from the redirect is only a claim to verify
  ([Callback](#callback)).
- Their paths don't collide with the generic `:uuid` routes: those always end in `/show.json`,
  `/test.json` or `/credential.json`, or are `PATCH`/`DELETE`.
- The `Integration` response is the generic one ([api.md](../api.md#integration-response)).

### Start

Request body, validated with the usual DTO rules (unknown fields stripped):

- **Exactly one** of `label` (create) and `integrationId` (replace credential). Both or neither
  answer 400 `VALIDATION_FAILED`.
- `label`: the generic label rules ([model.md](../model.md#constraints)).
- `integrationId`: a UUID string.
- `mode`: optional, `install` (default) or `connect`. Any other value answers 400
  `VALIDATION_FAILED`.

Checks, in order. Each failure stops there and stores nothing (same order as the
[OAuth App's start](oauth-app.md#start)):

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND` (see [Server config](#server-config)).
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Replace only:** owner-scoped lookup of `integrationId` (`uuid` + `user_id`). A foreign or
   missing row answers **404** `NOT_FOUND`. A row whose `type` isn't `github_app` answers 400
   `INTEGRATION_FLOW_UNSUPPORTED` (changing type means delete and create).
5. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`
   ([security.md](../security.md#create-and-replace-credential-failure-cool-off)). Checked again
   on callback and select.
6. **Create only:** per-user cap (409 `INTEGRATIONS_LIMIT_REACHED`) and label uniqueness (409
   `INTEGRATION_LABEL_TAKEN`). Checked again on callback and select.
7. Create a `redirect` [state](#state) row and answer with the redirect URL.

No GitHub call is made by start, and start never counts toward the cool-off.

The `redirectUrl` depends on `mode` (query parameters URL-encoded):

| Mode | URL | Query parameters |
|---|---|---|
| `install` | `https://github.com/apps/<KERGHAN_GITHUB_APP_SLUG>/installations/new` | `state` |
| `connect` | `https://github.com/login/oauth/authorize` | `client_id` (`KERGHAN_GITHUB_APP_CLIENT_ID`), `redirect_uri` (the callback URL, [Server config](#server-config)), `state`, `allow_signup=false`, `prompt=select_account` |

- No `scope` parameter: a GitHub App's user token gets the app's permissions, not OAuth scopes.
- No PKCE parameters. GitHub's installation page doesn't take them, and keeping one shape for
  both modes keeps the state row simpler. The code is useless without the client secret, which
  only the server holds. #303 re-checks whether GitHub's install flow forwards PKCE; if it does,
  adding a `code_verifier` column like the OAuth App's is a compatible later change.
- The frontend navigates with `window.location.assign`, after checking the URL matches
  `^https://github\.com/apps/[a-z0-9-]+/installations/new\?` or starts with
  `https://github.com/login/oauth/authorize?`. Anything else is shown as an error and not
  followed.

### Landing

With *Request user authorization (OAuth) during installation* enabled, GitHub sends the browser
to the app's **callback URL** (not its setup URL) after installation and authorization. Per
GitHub's docs, the query string then carries `code`, `state`, and, for install flows,
`installation_id` and `setup_action`. A connect flow carries only `code` and `state`. A
cancelled authorization carries `error`, `error_description` and `state`. #303 re-checks these
against GitHub's docs, including that `state` survives the installation page.

The frontend, booting on that path:

1. Reads `code`, `state`, `installation_id`, `setup_action` and `error` from
   `window.location.search`.
2. **Before any other request**, calls `history.replaceState` to `/#/account/integrations`,
   removing the path, query string and hash
   ([redirect flow invariants](../type-contract.md#redirect-flow-invariants)). The values only
   live in memory from then on.
3. Decides, without any call:
   - `error=access_denied`: shows "You cancelled the GitHub authorization."
   - `setup_action=request`: an organization member asked an owner to approve the installation,
     so there is no installation yet. Shows "Waiting for an organization owner to approve the
     installation. Once they do, use *Connect existing installation*."
   - Any other `error`, a missing `code` or `state`, a `setup_action` other than `install` or
     `update`, or an `installation_id` that isn't a positive integer: shows "GitHub didn't
     complete the installation. Try again."

   In these cases the unused `state` row simply expires.
4. Otherwise `POST`s `{ code, state }`, plus `installationId` (as a number) and `setupAction`
   when present, to the callback route, and shows the result on the Integrations page: success,
   the [selection](#selection) list, or the mapped error text.

`setup_action` values:

| Value | Meaning | Handling |
|---|---|---|
| `install` | A new installation was created. | Verified like any claim ([Callback](#callback)). |
| `update` | An admin reconfigured an installation that already existed (e.g. the account already had the app). | Same as `install`. |
| `request` | A member asked an owner to install it; no installation exists. | Frontend only, no call (step 3). |
| absent | Connect mode (plain authorization). | Callback without `installationId` ([Selection](#selection)). |

A logged-out user landing there gets the usual logged-out behaviour; the flow has to be started
again after logging in (the callback needs the cookie). The installation on GitHub is kept;
connect mode then finds it.

### Callback

Request body:

- `code`: string, 1–255 characters of `[A-Za-z0-9_-]`.
- `state`: string matching the [State](#state) format.
- `installationId`: optional, a positive integer below 2^53.
- `setupAction`: optional, `install` or `update`; required when `installationId` is present and
  forbidden otherwise (400 `VALIDATION_FAILED`).
- Messages never echo `code` or `state`.

Checks, in order:

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND`.
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Consume the `state`** ([State](#state)), which must be a `redirect` row. Unknown, expired,
   already used, issued to another user, of the wrong stage, or a wrong secret all answer the
   same **400** `INTEGRATION_REDIRECT_STATE_INVALID`, without calling GitHub and without counting
   toward the cool-off. The row records whether this is a create (with its label) or a replace
   (with its target `uuid`).
5. **Replace only:** owner-scoped lookup of the stored target `uuid` again (it may have been
   deleted meanwhile) → **404** `NOT_FOUND`.
6. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`.
7. **Create only:** per-user cap and label uniqueness again → **409**.
8. **Ownership verification** ([Validate / create](#validate--create), steps 1–2): exchange the
   `code` for a user token and list the user's installations of this app.
9. **Revoke the user token** best-effort ([User token](#user-token)). It is never stored, and
   nothing below uses it.
10. Pick the installation:
    - **With `installationId`:** it must be in the list, or **422**
      `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`.
    - **Without `installationId`** (connect): an empty list → **422**
      `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`; exactly one → that one; more than one → answer
      the [selection](#selection) and stop here.
11. **Installation checks** ([Validate / create](#validate--create), steps 3–4), with the app
    JWT.
12. Store through the generic storage and encryption code: create inserts an `active` row
    (**201**); replace refreshes the row like a generic replace credential (**200**,
    [model.md](../model.md#transitions)). Nothing happens on GitHub to a previous installation.

The checks of steps 8, 10 and 11 count toward the create/replace failure cool-off exactly like a
pasted credential's ([Validate / create](#validate--create)). Counting the
`INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` failures is what makes guessing installation ids
pointless.

### Selection

When connect mode finds **several** installations the user can access, the callback doesn't
guess. It answers **200**:

```json
{
  "selection": {
    "state": "<uuid>.<secret>",
    "installations": [
      { "installationId": 12345678, "accountLogin": "acme", "accountType": "Organization" },
      { "installationId": 23456789, "accountLogin": "octocat", "accountType": "User" }
    ]
  }
}
```

- The installations are the verified list from step 8, filtered to this app, sorted by
  `accountLogin` (case-insensitive), at most **100** (more → only the first 100, and the UI says
  so).
- The `state` is a **new** `select` [state](#state) row, carrying the same purpose, label or
  target as the consumed `redirect` row, plus the candidate installation ids. It is the only
  `state` value ever returned in a response body; it is never put in a URL.
- No integration is created yet and no user token is kept: the verification already happened,
  and the `select` row records its result.

`POST /integrations/github_app/select.json` with `{ state, installationId }` then:

1. Auth and CSRF; type disabled → 404; body validation → 400 (`state` in the State format,
   `installationId` a positive integer).
2. Consume the `state`, which must be a `select` row; same 400
   `INTEGRATION_REDIRECT_STATE_INVALID` rules as the callback.
3. Replace only: owner lookup of the target again → 404. Cool-off → 423. Create only: cap and
   label → 409.
4. `installationId` not among the row's candidates → **422**
   `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` (counted).
5. Installation checks with the app JWT, then store, as callback steps 11–12.

### State

A server-side, single-use record of one started flow, in the table
`integrations_github_app_states`, owned by the Integrations module and created by #303's
migration (so it works across instances and restarts).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `int` auto-increment | no | Primary key. |
| `uuid` | `char(36)` | no | Unique. The public half of the `state` value. |
| `user_id` | `int` | no | Initiating user. Logical FK to `auth_users.id`, like the lockout table. |
| `secret_hash` | `char(64)` | no | Hex SHA-256 of the secret half of the `state` value. The secret itself is never stored. |
| `stage` | `varchar(16)` | no | `redirect` (created by start) or `select` (created by a callback answering a selection). |
| `purpose` | `varchar(16)` | no | `create` or `replace`. |
| `label` | `varchar(100)` | yes | Create only: the label as validated at start. |
| `integration_uuid` | `char(36)` | yes | Replace only: the target integration. |
| `candidate_installation_ids` | `json` | yes | `select` only: the verified installation ids (array of at most 100 positive integers). |
| `verified_by` | `varchar(39)` | yes | `select` only: the GitHub login that proved access in the callback, later stored as `metadata.verifiedBy` (the user token is revoked before the selection is answered). |
| `expires_at` | `datetime` | no | `created_at` + **10 minutes** (fixed; GitHub's codes also live 10 minutes). A `select` row gets its own 10 minutes. |
| `created_at` | `datetime` | no | Set on insert. |

Indexes: unique `uuid`; non-unique `user_id`; non-unique `expires_at`. The migration has a
working `down` that drops the table.

Rules: the same as the [OAuth App's state](oauth-app.md#state), namely:

- **Format:** `state` = `<uuid>.<secret>`, `<secret>` being 32 random bytes from Node's
  `crypto.randomBytes`, base64url without padding (43 characters). Validation pattern:
  `^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$`.
- **Bound to the user:** looked up with `uuid = ? AND user_id = ?` in the query itself.
- **Constant time:** SHA-256 of the submitted secret compared with `secret_hash` using
  `crypto.timingSafeEqual`.
- **Single use:** consumed with an atomic `DELETE … WHERE id = ?`, proceeding only if exactly one
  row was deleted. A row whose secret doesn't match, or whose `stage` is wrong for the route, is
  deleted too.
- **Short-lived:** a row past `expires_at` is rejected (and deleted).
- **Bounded:** every start and every selection deletes all expired rows, then keeps at most
  **5** pending rows per user by deleting that user's oldest ones. No background job.
- **Not a credential:** the `state` and its secret are never logged, returned (other than inside
  `redirectUrl` or a selection) or put in error messages. Candidate installation ids aren't
  secret, but they are only ever returned to the user who proved access to them.
- **Account deletion** (not possible today): pending rows of the user must be deleted with
  them; they expire within 10 minutes regardless.

**Rejected alternative:** generalizing `integrations_oauth_states` with a `type` column. It would
avoid a second table, but it reopens #298's merged spec and #302's migration, and the two flows
need different columns (`code_verifier` there, `stage` and candidates here).

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

- The app is registered with exactly **Issues: read** and **Metadata: read** (repository
  permissions), and nothing else: no write permission, no organization or account permission.
- An installation is accepted only if its `permissions` object (from
  `GET /app/installations/{id}`) has `issues` and `metadata` each set to `read` or `write`.
  `write` can only appear if the app's permissions were changed on GitHub; it is accepted but
  recorded as-is in `metadata.permissions`.
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
([security.md](../security.md#faking-github)). There is no `validate(secret)` call on a pasted
value: the strategy exposes the steps below to the type-owned routes, which end with the generic
storage code, as the [type contract](../type-contract.md#flow-kind) requires.

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
  installation beyond them answers `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`. #303 logs it at
  warn level.
- The suspended case gets its own code, rather than `INTEGRATION_CREDENTIAL_INVALID`, because
  the user can fix it on GitHub and the UI must tell them how.

### App JWT

- Signed **RS256** with the private key ([Server config](#server-config)); claims `iat` = now
  − 60 s, `exp` = now + 9 min (GitHub's maximum is 10), `iss` = the app's **client id** (GitHub
  accepts the client id or the app id; #303 re-checks the current recommendation).
- Minted per use, kept only in memory for that call, never logged, stored or returned.
- Signing uses Node's `crypto` (or a vetted JWT library already in the backend). #303 picks
  one; no hand-rolled base64url or signature code beyond what `crypto` provides.

## Secret payload shape

The plaintext JSON encrypted into `secret_ciphertext` ([model.md](../model.md#storage-model)):

```json
{ "installationId": 12345678 }
```

- Only the installation id. The id isn't secret on its own, but it goes through the generic
  secret path anyway, so the generic code stays type-agnostic, and the AAD binds it to its row
  ([security.md](../security.md#binding-to-the-row-aad)): copying one row's ciphertext onto
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
  never stored, so their expiry never reaches the row.
- An installation stops working when it is uninstalled or suspended, or loses permissions; each
  shows up on the next test ([Test connection](#test-connection)). There are no webhooks
  (`product.md`), so nothing notices it earlier.

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
  `GITHUB_UNAVAILABLE`. This differs from the [OAuth App](oauth-app.md#test-connection), whose
  test only needs the stored token. The UI avoids the case: it disables *Test* on `github_app`
  rows while the type is disabled ([When disabled](#when-disabled)).
- Transient outcomes leave the status unchanged ([model.md](../model.md#transitions)).

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

## Server config

| Variable | Status | Rules |
|---|---|---|
| `KERGHAN_GITHUB_APP_ID` | optional | The app id: a positive integer. |
| `KERGHAN_GITHUB_APP_SLUG` | optional | The app's URL slug: 1–100 characters of `[a-z0-9-]`. |
| `KERGHAN_GITHUB_APP_PRIVATE_KEY` | optional, secret | The app's private key: **base64** of the PEM file GitHub provides, in one line. Decoded and parsed at boot with `crypto.createPrivateKey`; must be an RSA private key. |
| `KERGHAN_GITHUB_APP_CLIENT_ID` | optional | The app's client id: 1–100 characters of `[A-Za-z0-9._-]`. |
| `KERGHAN_GITHUB_APP_CLIENT_SECRET` | optional, secret | The app's client secret. |

- All are read **once at boot** (DI, no env reads inside classes), trimmed.
- **All five unset or blank:** the `github_app` type is **disabled**.
- **All five set and valid:** enabled.
- **Some set, some not:** boot **fails**, with an error naming the missing variables (never
  printing any value). A malformed value (non-numeric id, bad slug, a key that doesn't decode or
  parse as RSA, bad client id) fails boot the same way, naming the variable only.
- The private key and the client secret are never logged, returned, or put in an error message,
  and are held as `Secret`s after boot.
- **Callback URL:** not a separate variable. It is the **origin** of `FRONTEND_BASE_URL` plus
  `/integrations/github_app/callback`, computed at boot. When the type is enabled:
  - `FRONTEND_BASE_URL` must be set, or boot fails;
  - with `NODE_ENV=production`, its origin must be `https`, or boot fails.
- **Per environment:** each environment registers **its own** GitHub App, so keys and callback
  URLs never cross environments:

  | Environment | Callback URL | Config |
  |---|---|---|
  | Dev | `http://localhost:3000/integrations/github_app/callback` (Tent's port) | Disabled by default. A developer who wants to try it registers a personal throwaway GitHub App and sets all five variables in `.env`; `.env.dev.sample` lists them commented out, with this explanation. |
  | CI | none | Unset: the type is disabled. Specs build the strategy and routes with fake config (a test-only RSA key generated in the spec) and the fake GitHub client. |
  | Production | `https://<public host>/integrations/github_app/callback` | All five set as backend host env vars. |

- **App settings to register on GitHub**, per environment:
  - *Callback URL*: the environment's callback URL above;
  - *Request user authorization (OAuth) during installation*: **on** (this disables the setup
    URL, which isn't used);
  - *Expire user authorization tokens*: either; the refresh token is never used;
  - *Webhook*: **inactive** (no webhook URL or secret);
  - repository permissions: Issues: read, Metadata: read; nothing else;
  - *Where can this GitHub App be installed?*: *Any account* in production; either in dev.
- #303 documents the variables and the per-environment setup in
  `docs/agents/environment-variables.md`, and adds the commented entries to `.env.dev.sample`.

### When disabled

- `POST /integrations/types.json` doesn't list `github_app` ([api.md](../api.md#enabled-types)),
  so the type picker hides it ([ui.md](../ui.md#type-picker)).
- The three type-owned backend routes answer **404** `NOT_FOUND`, before any other check except
  auth and CSRF, as if they didn't exist.
- Existing `github_app` rows stay listed and can be renamed and deleted. Test answers
  `unavailable` ([Test connection](#test-connection)); the UI disables *Test* and *Reconnect*
  for them and says the GitHub App is disabled on this server.

## Proxy (Tent)

### Landing page rule

A **dedicated Tent rule** for `/integrations/github_app/callback`, identical in behaviour to the
[OAuth App's landing rule](oauth-app.md#landing-page-rule), which #302 adds. #303's `proxy` work
adds it to both `dev_configuration` and `prod_configuration`:

- **Matcher:** `GET` on the path `/integrations/github_app/callback`, with or without a query
  string, and nothing else. If Tent's `exact` matcher compares the query string too, a regex
  anchored as `^/integrations/github_app/callback(\?|$)` is used instead.
- **Precedence:** it wins over `backend.php` and `redirects.php` for this path, so the query
  string is never moved into the hash by the catch-all.
- **Handler:** production serves `index.html` from the static root; dev proxies to Vite.
- **Headers:** `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, reusing the
  middleware #302 adds (no new middleware unless #302's can't be reused, in which case #303 adds
  it with PHPUnit specs).

### Backend routes

**No new Tent rule.** The start, callback and select routes end in `.json`, so the existing
backend rule forwards them. Their `X-Skip-Cache` header (cache class `never`) keeps them out of
Tent's cache, and Navi never warms them.

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
[type contract](../type-contract.md#what-a-type-spec-must-contain):

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
  ([security.md](../security.md#access-rules)). Admins get no access to anyone else's flow.
- **Same installation, several integrations or users:** allowed and isolated
  ([model.md](../model.md#edge-cases)). Each user proves access on their own. Nothing (status,
  error code, message, selection list) reveals that another Kerghan user holds the same
  installation.
- They are cache class `never`.
- They follow the generic logging, `Secret` and canary rules: the code, the user token, its
  refresh token, installation tokens, the app JWT, the private key, the client secret and the
  `state` never reach a logger call, an error message or a response (other than `state` inside
  `redirectUrl` or a selection).

## Error cases

Summary of the error codes ([api.md](../api.md#error-codes)) this type produces:

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

## UI guidance

For #303's frontend work (on top of the generic [UI shell](../ui.md) and #302's landing
plumbing):

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
- **Landing:** see [Landing](#landing). Success shows the new or updated row with "Connected to
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

## Required tests

Every spec uses the fake GitHub client ([security.md](../security.md#faking-github)) and a
recognisable **canary** code, user token, refresh token, installation token, `state` secret,
client secret and private key (a test-only RSA key), asserting none of them, nor any app JWT,
appears in logger calls, thrown errors, error bodies, API responses (other than `state` inside
`redirectUrl` or a selection), the stored `metadata` or the `secretHint`.

- **Config (boot):** all unset → disabled; all set → enabled with the callback URL derived from
  `FRONTEND_BASE_URL`'s origin; any partial set → boot fails naming the missing variables; a
  non-numeric app id, bad slug, undecodable or non-RSA key, bad client id, missing
  `FRONTEND_BASE_URL` and a non-`https` origin under `NODE_ENV=production` each fail boot; no
  error contains the key or the secret.
- **App JWT:** RS256, `iat`/`exp`/`iss` as specified, verifiable with the test key's public
  half; a fresh JWT per call.
- **Start:** both modes, create and replace, return the right `redirectUrl`; an unknown `mode`,
  and both or neither of `label`/`integrationId` → 400; disabled → 404; foreign or missing
  `integrationId` → 404 (even while locked out); a non-`github_app` target → 400
  `INTEGRATION_FLOW_UNSUPPORTED`; cool-off → 423; cap and duplicate label → 409; no GitHub call
  in any case; expired rows are purged and at most 5 pending rows are kept per user.
- **State:** a valid `state` is consumed once (a replay → 400); expired, unknown, another user's,
  wrong secret and wrong stage (a `select` row on callback, a `redirect` row on select) each →
  the same 400 `INTEGRATION_REDIRECT_STATE_INVALID` without a GitHub call and without counting;
  two parallel callbacks with the same `state` make a single code exchange; no row holds the raw
  secret.
- **Ownership (the key security tests):**
  - a forged `installationId` that isn't in `GET /user/installations` → 422
    `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`, counted, with no app-JWT call and nothing stored,
    even though the app JWT would see the installation;
  - an installation of a different `app_id` in the user's list is ignored;
  - a select with an id outside the row's candidates → 422, counted;
  - the error body is the same for "doesn't exist", "someone else's" and "another app's";
  - the user token is revoked on success and on every failure after the exchange, and is never
    stored.
- **Callback / select:** install success creates an `active` row (201) with the
  `installation …` hint, the account's login, the full metadata and `expiresAt: null`; replace
  refreshes the row (200) and makes no GitHub call about the previous installation; connect with
  one installation stores it directly; with several, answers the selection (sorted, at most
  100, other apps filtered out) and creates a `select` row; select stores the chosen one;
  connect with none → 422; each row of the [error mapping](#validate--create) table; label taken
  or cap reached at callback or select → 409; a replace target deleted meanwhile → 404; disabled
  → 404.
- **Test:** each row of the [Test connection](#test-connection) table, including `unavailable`
  without a GitHub call while disabled, and `verifiedBy` kept on refresh.
- **Metadata:** `describeMetadata` accepts the valid shape and rejects an extra key, a missing
  key, wrong types and out-of-range values; a decrypted payload with an extra key or a non-integer
  id is handled as `undecryptable`.
- **Mask:** `installation …` plus the last 4 digits.
- **Delete:** no GitHub call, for active, invalid and `undecryptable` rows, and with the type
  disabled.
- **Generic routes:** generic create and replace credential with `github_app` → 400
  `INTEGRATION_FLOW_UNSUPPORTED`; the types route lists `github_app` only when enabled.
- **Caching and CSRF:** the three routes declare cache class `never` and send `X-Skip-Cache` and
  `Cache-Control: no-store`; a cross-site `POST` → 403.
- **Frontend:** the landing handler calls `replaceState` before any request;
  `access_denied`, `setup_action=request`, other errors and missing or malformed values make no
  call and show their texts; the callback, selection and select results render; a `redirectUrl`
  that isn't one of the two GitHub shapes is not followed; the picker hides `github_app` when the
  types route doesn't list it; *Test* and *Reconnect* are disabled for `github_app` rows then;
  canary `code`/`state` never reach `console`, storage or the URL.
- **Proxy:** the landing rule in both configurations serves the SPA for the path, with and
  without a query string, with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

## Manual smoke check (#303)

In the running app (dev), with a personal throwaway GitHub App registered as in
[Server config](#server-config) (callback URL
`http://localhost:3000/integrations/github_app/callback`, user authorization during installation
on, webhook inactive, Issues and Metadata read), and all five variables set:

1. Open `http://localhost:3000/integrations/github_app/callback?code=x&state=y` directly: the SPA
   loads (no redirect to `/#/…`), the response has `Cache-Control: no-store` and
   `Referrer-Policy: no-referrer`, the address bar ends up at `/#/account/integrations` with no
   query string, and the "expired or already used" error shows.
2. Add a *GitHub App* integration with *Install on GitHub*, install it on your user account
   (selected repositories) and authorize: the row is `active`, shows `installation …` plus 4
   digits, your login, "selected repositories" and "no expiry".
3. Replay the landing URL with the back button: "expired or already used", nothing created.
4. Start a flow, then edit the landing URL's `installation_id` to another number before it
   loads: 422 "can't access that installation", nothing created; repeat until the cool-off
   locks (423).
5. With the app installed on your account and on a test organization, use *Connect existing
   installation*: the selection lists both; pick the organization; the row shows it.
6. As a second Kerghan user with the same GitHub account, connect the same installation: it
   works, and nothing in either account mentions the other.
7. Suspend the installation on GitHub, then test: `invalid` with the `suspended` text. Unsuspend
   and test: `active`.
8. Uninstall it on GitHub, then test: `invalid` with the `uninstalled` text. Delete the row: the
   app stays as it is on GitHub (reinstall first to check that delete didn't uninstall it).
9. Unset the five variables and restart: the type is gone from the picker, existing rows can be
   renamed and deleted, *Test* is disabled for them, and
   `POST /integrations/github_app/start.json` answers 404.
10. Check the backend and Tent logs: no code, token, JWT, `state` secret, client secret or key
    appears.
