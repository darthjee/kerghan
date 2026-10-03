# Integration type: GitHub OAuth App (`oauth_app`)

Part of the [Integrations module](../integrations.md). Defines the `oauth_app` type, following the
[type contract](../integrations.md#what-a-type-doc-must-contain) and its
[redirect flow invariants](../integrations.md#redirect-flow-invariants). It fills every
per-type slot the generic module leaves open. Code: `backend/src/integrations/types/oauth-app/`.

## Overview

- The user clicks *Connect with GitHub*, approves Kerghan's OAuth App on GitHub, and Kerghan
  stores the resulting user access token as an integration.
- **Flow kind:** redirect-based only (see [Flow](#flow)).
- **Server config:** optional. Without the app's client id and secret the type is **disabled**
  (see [Server config](#server-config)).
- GitHub's exact endpoints, parameters, headers and token limits below follow GitHub's OAuth App
  and REST API docs.

## Flow

**Redirect-based only** (`flows: { credentialPaste: false, redirect: true }`). Generic create
(`POST /integrations.json`) and replace credential (`POST /integrations/:uuid/credential.json`)
with `type: oauth_app`, or on an `oauth_app` row, answer **400** `INTEGRATION_FLOW_UNSUPPORTED`
([routes](../../backend/routes/integrations.md#create-envelope)).

### Routes

| Step | Route | Served by | Body | Success |
|---|---|---|---|---|
| Start | `POST /integrations/oauth_app/start.json` | backend | `{ "label": "Work" }` (create) or `{ "integrationId": "<uuid>" }` (replace credential) | `200` `{ "authorizeUrl": "https://github.com/login/oauth/authorize?…" }` |
| Landing | `GET /integrations/oauth_app/callback?code=…&state=…` | Tent, serving the frontend directly ([Proxy](#proxy-tent)) | — | the SPA's `index.html` |
| Callback | `POST /integrations/oauth_app/callback.json` | backend | `{ "code": "…", "state": "…" }` | `201` `Integration` (create) or `200` `Integration` (replace) |

- Both backend routes sit behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`), are
  covered by `OriginGuard` (they are `POST`s), and are cache class `never`
  (`@CachePolicy(CacheClass.Never)` at controller level, so they send `X-Skip-Cache` and
  `Cache-Control: no-store`). Neither belongs in Navi's warm-up.
- The owner is always `req.user.sub`; nothing in the body or the GitHub redirect names a user.
- Their paths don't collide with the generic `:uuid` routes: those always end in `/show.json`,
  `/test.json` or `/credential.json`, or are `PATCH`/`DELETE`.
- The `Integration` response is the generic one
  ([routes](../../backend/routes/integrations.md#integration-response)).

### Start

Request body, validated with the usual DTO rules (unknown fields stripped):

- **Exactly one** of `label` (create) and `integrationId` (replace credential). Both or neither
  answer 400 `VALIDATION_FAILED`.
- `label`: the generic label rules ([data model](../integrations.md#constraints)).
- `integrationId`: a UUID string.

Checks, in order. Each failure stops there and stores nothing:

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND` (see [Server config](#server-config)).
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Replace only:** owner-scoped lookup of `integrationId` (`uuid` + `user_id`). A foreign or
   missing row answers **404** `NOT_FOUND`. A row whose `type` isn't `oauth_app` answers 400
   `INTEGRATION_FLOW_UNSUPPORTED` (changing type means delete and create).
5. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`
   ([security](../integrations.md#create-and-replace-credential-failure-cool-off)). Checked here
   so the user isn't sent to GitHub for nothing; it is checked again on callback.
6. **Create only:** per-user cap (409 `INTEGRATIONS_LIMIT_REACHED`) and label uniqueness (409
   `INTEGRATION_LABEL_TAKEN`). Also checked again on callback.
7. Create a `state` row ([State](#state)) and answer with the authorize URL.

No GitHub call is made by start, and start never counts toward the cool-off.

The authorize URL is
`https://github.com/login/oauth/authorize` with these query parameters (URL-encoded):

| Parameter | Value |
|---|---|
| `client_id` | `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` |
| `redirect_uri` | the callback URL ([Server config](#server-config)) |
| `scope` | `repo` |
| `state` | the opaque `state` value ([State](#state)) |
| `code_challenge` | base64url (no padding) of SHA-256 over the `code_verifier` |
| `code_challenge_method` | `S256` |
| `allow_signup` | `false` |
| `prompt` | `select_account`, so a user with several GitHub accounts picks one each time |

The frontend navigates to it with `window.location.assign`, after checking it starts with
`https://github.com/login/oauth/authorize?`; anything else is shown as an error and not followed.

### Landing

GitHub redirects the browser to the callback URL with `code` and `state` (or `error`,
`error_description` and `state` when the user cancels). The frontend, booting on that path:

1. Reads `code`, `state` and `error` from `window.location.search`.
2. **Before any other request**, calls `history.replaceState` to
   `/#/account/integrations`, removing the path, query string and hash
   ([redirect flow invariants](../integrations.md#redirect-flow-invariants)). The values only
   live in memory from then on.
3. With `error=access_denied`: shows "You cancelled the GitHub authorization." and makes no
   call. Any other `error`, or a missing `code` or `state`: shows "GitHub didn't complete the
   authorization. Try again." and makes no call. The unused `state` row simply expires.
4. Otherwise `POST`s `{ code, state }` to the callback route and shows the result on the
   Integrations page (success, or the mapped error text).

A logged-out user landing there gets the usual logged-out behaviour; the flow has to be started
again after logging in (the callback needs the cookie).

### Callback

Request body:

- `code`: string, 1–255 characters of `[A-Za-z0-9_-]`.
- `state`: string matching the [State](#state) format.
- Messages never echo either value.

Checks, in order:

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND`.
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Consume the `state`** ([State](#state)). Unknown, expired, already used, issued to
   another user, or a wrong secret all answer the same **400**
   `INTEGRATION_REDIRECT_STATE_INVALID`, without calling GitHub and without counting toward the
   cool-off. The row records whether this is a create (with its label) or a replace (with its
   target `uuid`).
5. **Replace only:** owner-scoped lookup of the stored target `uuid` again (it may have been
   deleted meanwhile) → **404** `NOT_FOUND`.
6. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`.
7. **Create only:** per-user cap and label uniqueness again → **409**.
8. `validate`: exchange the code and check the token ([Validate / create](#validate--create)).
9. Store through the generic storage and encryption code: create inserts an `active` row
   (**201**); replace refreshes the row like a generic replace credential (**200**,
   [data model](../integrations.md#transitions)).
10. **Replace only:** best-effort revocation of the **previous** token
    ([Revocation](#revocation)), unless GitHub returned the same token. Its failure doesn't
    change the response.

If any step after a successful code exchange fails (insufficient scope, label taken, cap
reached, row gone, storage error), the **new** token is revoked best-effort and nothing is
stored or changed. A token Kerghan doesn't keep never stays valid on purpose.

The credential checks of step 8 count toward the create/replace failure cool-off exactly like a
pasted credential's ([Validate / create](#validate--create)).

### State

A server-side, single-use record of one started flow, in the table
`integrations_oauth_states`, owned by the Integrations module and created by its own migration
(so it works across instances and restarts).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `int` auto-increment | no | Primary key. |
| `uuid` | `char(36)` | no | Unique. The public half of the `state` value. |
| `user_id` | `int` | no | Initiating user. Logical FK to `auth_users.id`, like the lockout table. |
| `secret_hash` | `char(64)` | no | Hex SHA-256 of the secret half of the `state` value. The secret itself is never stored. |
| `purpose` | `varchar(16)` | no | `create` or `replace`. |
| `label` | `varchar(100)` | yes | Create only: the label as validated at start. |
| `integration_uuid` | `char(36)` | yes | Replace only: the target integration. |
| `code_verifier` | `varchar(128)` | no | PKCE verifier: 32 random bytes, base64url (43 characters). |
| `expires_at` | `datetime` | no | `created_at` + **10 minutes** (fixed; GitHub's codes also live 10 minutes). |
| `created_at` | `datetime` | no | Set on insert. |

Indexes: unique `uuid`; non-unique `user_id`; non-unique `expires_at`. The migration has a
working `down` that drops the table.

Rules:

- **Format:** `state` = `<uuid>.<secret>`, where `<secret>` is 32 random bytes from Node's
  `crypto.randomBytes`, base64url without padding (43 characters). Validation pattern:
  `^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$`.
- **Bound to the user:** looked up with `uuid = ? AND user_id = ?` in the query itself, so a
  `state` started by another user is indistinguishable from an unknown one.
- **Constant time:** the SHA-256 of the submitted secret is compared with `secret_hash` using
  `crypto.timingSafeEqual`.
- **Single use:** the row is consumed with an atomic `DELETE … WHERE id = ?`, and the callback
  proceeds only if exactly one row was deleted, so two parallel callbacks can't both succeed. A
  row whose secret doesn't match is deleted too.
- **Short-lived:** a row past `expires_at` is rejected (and deleted).
- **Bounded:** every start deletes all expired rows, then keeps at most **5** pending rows per
  user by deleting that user's oldest ones. No background job.
- **Not a credential:** the `state`, its secret and the `code_verifier` are never logged,
  returned (other than `state` inside `authorizeUrl`) or put in error messages. The verifier is
  useless without a matching code and the client secret, so it is stored as-is and deleted with
  the row.
- **Account deletion** (not possible today): pending rows of the user must be deleted with
  them; they expire within 10 minutes regardless.

## Required scopes

- Request and require **`repo`** only, for the same reason as classic PATs: private
  repositories need it ([PAT](pat.md#classic-tokens)).
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
([security](../integrations.md#faking-github-in-tests)), with two GitHub calls.

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
token ([Callback](#callback)).

## Secret payload shape

The plaintext JSON encrypted into `secret_ciphertext`
([data model](../integrations.md#storage-model)):

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
- Transient outcomes leave the status unchanged ([data model](../integrations.md#transitions)).

## `invalid` reason codes

| Code | When | UI text |
|---|---|---|
| `revoked` | GitHub answers 401: the app was revoked, the token was unused for a year or replaced by newer authorizations, or it was revoked by GitHub or an organization. | "GitHub no longer accepts this authorization. It may have been revoked on GitHub, unused for a year, or replaced by newer authorizations. Reconnect to fix it." |
| `insufficient_permissions` (generic) | The token no longer has the `repo` scope. | "This authorization lacks the `repo` scope. Reconnect with GitHub to grant it." |

## `secretHint` format

The `gho_` prefix, an ellipsis (`…`, U+2026) and the **last 4 characters** of the token, e.g.
`gho_…a1b2` (9 characters, well within the 64-character limit). It never includes more of the
token than the prefix and the last 4 characters.

## Server config

| Variable | Status | Rules |
|---|---|---|
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` | optional | The OAuth App's client id: 1–100 characters of `[A-Za-z0-9._-]`. |
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` | optional, secret | The OAuth App's client secret. Never logged, never returned, never in an error message. |

- Both are read **once at boot** (DI, no env reads inside classes), trimmed.
- **Both unset or blank:** the `oauth_app` type is **disabled**.
- **Only one set:** boot **fails**, with an error naming the missing variable (never printing
  either value). A malformed client id fails boot the same way.
- **Callback URL:** not a separate variable. It is the **origin** of `FRONTEND_BASE_URL` plus
  `/integrations/oauth_app/callback`, computed at boot. When the type is enabled:
  - `FRONTEND_BASE_URL` must be set, or boot fails;
  - with `NODE_ENV=production`, its origin must be `https`, or boot fails.
- **Per environment:** each environment registers **its own** OAuth App on GitHub, whose
  *Authorization callback URL* is exactly that environment's callback URL:

  | Environment | Callback URL | Config |
  |---|---|---|
  | Dev | `http://localhost:3000/integrations/oauth_app/callback` (Tent's port) | Disabled by default. A developer who wants to try it registers a personal OAuth App and sets both variables in `.env`; `.env.dev.sample` lists them commented out, with this explanation. |
  | CI | none | Unset: the type is disabled. Specs build the strategy and routes with fake config and the fake GitHub client. |
  | Production | `https://<public host>/integrations/oauth_app/callback` | Both set as backend host env vars. |

- Both variables and the per-environment setup are documented in
  [environment variables](../../environment-variables.md); `.env.dev.sample` lists them
  commented out.

### When disabled

- `POST /integrations/types.json` doesn't list `oauth_app`
  ([routes](../../backend/routes/integrations.md#enabled-types)), so the type picker hides it
  ([frontend](../integrations.md#type-picker)).
- Both type-owned backend routes answer **404** `NOT_FOUND`, before any other check except
  auth and CSRF, as if they didn't exist.
- Existing `oauth_app` rows (from when it was enabled) stay listed and can be renamed, tested
  and deleted. Their delete skips revocation ([Behaviour on delete](#behaviour-on-delete)). The
  UI doesn't offer *Reconnect* for them and says the OAuth App is disabled on this server.

## Proxy (Tent)

### Landing page rule

A **dedicated Tent rule** serves the frontend directly for the landing path, so it never goes
through the `GET /path → /#/path` catch-all (which would move `code` and `state` into the hash)
nor the backend's `.json` rule. It lives in `rules/frontend.php` of both `dev_configuration` and
`prod_configuration`:

- **Matcher:** `GET` on the path `/integrations/oauth_app/callback`, with or without a query
  string, and nothing else (Tent's `exact` matcher on the path; no prefix match on other
  paths).
- **Precedence:** the rule must win over `backend.php` and `redirects.php` for this path;
  `frontend.php` is already loaded first in both `configure.php` files.
- **Handler:** production serves `index.html` from the static root (the `static` handler with
  `SetPathMiddleware` to `/index.html`, like the `/` rule). Dev proxies to the Vite server,
  which answers its SPA `index.html`.
- **No caching:** `Cache-Control: no-store`, and no Tent file cache (the `static` handler doesn't
  use one). The headers are set by `SetResponseHeadersMiddleware`
  (`proxy/extension/lib/middlewares/`), since `CacheControlMiddleware` only sets `max-age`.
- **Referrer policy:** the response carries `Referrer-Policy: no-referrer`, so the URL with
  `code` and `state` never leaks through a `Referer` header before `replaceState` runs.
- The SPA's assets must load from this nested path: they are referenced by absolute paths
  (`/assets/…`) in both dev and production builds.

### Backend routes

**No new Tent rule.** `POST /integrations/oauth_app/start.json` and
`POST /integrations/oauth_app/callback.json` end in `.json`, so the existing backend rule
forwards them. Their `X-Skip-Cache` header (cache class `never`) keeps them out of Tent's cache,
and Navi never warms them.

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
[type contract](../integrations.md#what-a-type-doc-must-contain):

- They require `JwtGuard` and are covered by `OriginGuard`.
- The owner comes from `req.user.sub` only. The GitHub redirect is bound to the initiating user
  through the `state` row's `user_id`, never through any id carried in the callback.
- Replace credential targets only a row found with `uuid` + `user_id` in the query, both at
  start and again at callback; a foreign or missing row answers 404
  ([security](../integrations.md#access-rules)). Admins get no access to anyone else's flow.
- They are cache class `never`.
- They follow the generic logging, `Secret` and canary rules: the code, the token, the client
  secret, the `state` and the verifier never reach a logger call, an error message or a
  response (other than `state` inside `authorizeUrl`).

## Error cases

Summary of the error codes
([routes](../../backend/routes/integrations.md#error-codes)) this type produces:

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

On top of the generic [UI shell](../integrations.md#frontend):

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
- **Landing:** see [Landing](#landing). Success shows the new or updated row with "Connected to
  GitHub as `<login>`"; errors use the generic error mapping, plus
  `INTEGRATION_REDIRECT_STATE_INVALID` → "This GitHub authorization link expired or was already
  used. Start again."
- **Remove confirmation:** see [Behaviour on delete](#behaviour-on-delete).
- The `code` and `state` never reach `console`, storage, component state beyond the single
  callback request, or the URL after `replaceState`.
