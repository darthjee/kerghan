# OAuth App: flow

Part of the [OAuth App type](../oauth-app.md). Routes, start, landing, callback and the `state` record.

## Flow

**Redirect-based only** (`flows: { credentialPaste: false, redirect: true }`). Generic create
(`POST /integrations.json`) and replace credential (`POST /integrations/:uuid/credential.json`)
with `type: oauth_app`, or on an `oauth_app` row, answer **400** `INTEGRATION_FLOW_UNSUPPORTED`
([routes](../../../backend/routes/integrations.md#create-envelope)).

### Routes

| Step | Route | Served by | Body | Success |
|---|---|---|---|---|
| Start | `POST /integrations/oauth_app/start.json` | backend | `{ "label": "Work" }` (create) or `{ "integrationId": "<uuid>" }` (replace credential) | `200` `{ "authorizeUrl": "https://github.com/login/oauth/authorize?…" }` |
| Landing | `GET /integrations/oauth_app/callback?code=…&state=…` | Tent, serving the frontend directly ([Proxy](config-and-proxy.md#proxy-tent)) | — | the SPA's `index.html` |
| Callback | `POST /integrations/oauth_app/callback.json` | backend | `{ "code": "…", "state": "…" }` | `201` `Integration` (create) or `200` `Integration` (replace) |

- Both backend routes sit behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`), are
  covered by `OriginGuard` (they are `POST`s), and are cache class `never`
  (`@CachePolicy(CacheClass.Never)` at controller level, so they send `X-Skip-Cache` and
  `Cache-Control: no-store`). Neither belongs in Navi's warm-up.
- The owner is always `req.user.sub`; nothing in the body or the GitHub redirect names a user.
- Their paths don't collide with the generic `:uuid` routes: those always end in `/show.json`,
  `/test.json` or `/credential.json`, or are `PATCH`/`DELETE`.
- The `Integration` response is the generic one
  ([routes](../../../backend/routes/integrations.md#integration-response)).

### Start

Request body, validated with the usual DTO rules (unknown fields stripped):

- **Exactly one** of `label` (create) and `integrationId` (replace credential). Both or neither
  answer 400 `VALIDATION_FAILED`.
- `label`: the generic label rules ([data model](../data-model.md#constraints)).
- `integrationId`: a UUID string.

Checks, in order. Each failure stops there and stores nothing:

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND` (see [Server config](config-and-proxy.md#server-config)).
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Replace only:** owner-scoped lookup of `integrationId` (`uuid` + `user_id`). A foreign or
   missing row answers **404** `NOT_FOUND`. A row whose `type` isn't `oauth_app` answers 400
   `INTEGRATION_FLOW_UNSUPPORTED` (changing type means delete and create).
5. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`
   ([security](../security.md#create-and-replace-credential-failure-cool-off)). Checked here
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
| `redirect_uri` | the callback URL ([Server config](config-and-proxy.md#server-config)) |
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
   ([redirect flow invariants](../type-contract.md#redirect-flow-invariants)). The values only
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
8. `validate`: exchange the code and check the token ([Validate / create](credentials.md#validate--create)).
9. Store through the generic storage and encryption code: create inserts an `active` row
   (**201**); replace refreshes the row like a generic replace credential (**200**,
   [data model](../data-model.md#transitions)).
10. **Replace only:** best-effort revocation of the **previous** token
    ([Revocation](lifecycle.md#revocation)), unless GitHub returned the same token. Its failure doesn't
    change the response.

If any step after a successful code exchange fails (insufficient scope, label taken, cap
reached, row gone, storage error), the **new** token is revoked best-effort and nothing is
stored or changed. A token Kerghan doesn't keep never stays valid on purpose.

The credential checks of step 8 count toward the create/replace failure cool-off exactly like a
pasted credential's ([Validate / create](credentials.md#validate--create)).

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

