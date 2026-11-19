# GitHub App: flow

Part of the [GitHub App type](../github-app.md). Routes, start, landing, callback, selection and the `state` record.

## Flow

**Redirect-based only** (`flows: { credentialPaste: false, redirect: true }`). Generic create
(`POST /integrations.json`) and replace credential (`POST /integrations/:uuid/credential.json`)
with `type: github_app`, or on a `github_app` row, answer **400** `INTEGRATION_FLOW_UNSUPPORTED`
([routes](../../../backend/routes/integrations.md#create-envelope)).

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
| Landing | `GET /integrations/github_app/callback?code=…&installation_id=…&setup_action=…&state=…` | Tent, serving the frontend directly ([Proxy](config-and-proxy.md#proxy-tent)) | — | the SPA's `index.html` |
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
- The `Integration` response is the generic one
  ([routes](../../../backend/routes/integrations.md#integration-response)).

### Start

Request body, validated with the usual DTO rules (unknown fields stripped):

- **Exactly one** of `label` (create) and `integrationId` (replace credential). Both or neither
  answer 400 `VALIDATION_FAILED`.
- `label`: the generic label rules ([data model](../data-model.md#constraints)).
- `integrationId`: a UUID string.
- `mode`: optional, `install` (default) or `connect`. Any other value answers 400
  `VALIDATION_FAILED`.

Checks, in order. Each failure stops there and stores nothing (same order as the
[OAuth App's start](../oauth-app.md#start)):

1. Auth and CSRF (global guards).
2. Type disabled → **404** `NOT_FOUND` (see [Server config](config-and-proxy.md#server-config)).
3. Body validation → 400 `VALIDATION_FAILED`.
4. **Replace only:** owner-scoped lookup of `integrationId` (`uuid` + `user_id`). A foreign or
   missing row answers **404** `NOT_FOUND`. A row whose `type` isn't `github_app` answers 400
   `INTEGRATION_FLOW_UNSUPPORTED` (changing type means delete and create).
5. Failure cool-off active → **423** `INTEGRATION_CREDENTIAL_LOCKED`
   ([security](../security.md#create-and-replace-credential-failure-cool-off)). Checked again
   on callback and select.
6. **Create only:** per-user cap (409 `INTEGRATIONS_LIMIT_REACHED`) and label uniqueness (409
   `INTEGRATION_LABEL_TAKEN`). Checked again on callback and select.
7. Create a `redirect` [state](#state) row and answer with the redirect URL.

No GitHub call is made by start, and start never counts toward the cool-off.

The `redirectUrl` depends on `mode` (query parameters URL-encoded):

| Mode | URL | Query parameters |
|---|---|---|
| `install` | `https://github.com/apps/<KERGHAN_GITHUB_APP_SLUG>/installations/new` | `state` |
| `connect` | `https://github.com/login/oauth/authorize` | `client_id` (`KERGHAN_GITHUB_APP_CLIENT_ID`), `redirect_uri` (the callback URL, [Server config](config-and-proxy.md#server-config)), `state`, `allow_signup=false`, `prompt=select_account` |

- No `scope` parameter: a GitHub App's user token gets the app's permissions, not OAuth scopes.
- No PKCE parameters. GitHub's installation page doesn't take them, and keeping one shape for
  both modes keeps the state row simpler. The code is useless without the client secret, which
  only the server holds. If GitHub's install flow ever forwards PKCE, adding a `code_verifier`
  column like the OAuth App's is a compatible later change.
- The frontend navigates with `window.location.assign`, after checking the URL matches
  `^https://github\.com/apps/[a-z0-9-]+/installations/new\?` or starts with
  `https://github.com/login/oauth/authorize?`. Anything else is shown as an error and not
  followed.

### Landing

With *Request user authorization (OAuth) during installation* enabled, GitHub sends the browser
to the app's **callback URL** (not its setup URL) after installation and authorization. Per
GitHub's docs, the query string then carries `code`, `state`, and, for install flows,
`installation_id` and `setup_action`. A connect flow carries only `code` and `state`. A
cancelled authorization carries `error`, `error_description` and `state`. The `state` survives
the installation page.

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
8. **Ownership verification** ([Validate / create](credentials.md#validate--create), steps 1–2): exchange the
   `code` for a user token and list the user's installations of this app.
9. **Revoke the user token** best-effort ([User token](credentials.md#user-token)). It is never stored, and
   nothing below uses it.
10. Pick the installation:
    - **With `installationId`:** it must be in the list, or **422**
      `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`.
    - **Without `installationId`** (connect): an empty list → **422**
      `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`; exactly one → that one; more than one → answer
      the [selection](#selection) and stop here.
11. **Installation checks** ([Validate / create](credentials.md#validate--create), steps 3–4), with the app
    JWT.
12. Store through the generic storage and encryption code: create inserts an `active` row
    (**201**); replace refreshes the row like a generic replace credential (**200**,
    [data model](../data-model.md#transitions)). Nothing happens on GitHub to a previous
    installation.

The checks of steps 8, 10 and 11 count toward the create/replace failure cool-off exactly like a
pasted credential's ([Validate / create](credentials.md#validate--create)). Counting the
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
`integrations_github_app_states`, owned by the Integrations module and created by its own
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

Rules: the same as the [OAuth App's state](../oauth-app.md#state), namely:

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
avoid a second table, but it would rework the OAuth App's table and migration, and the two flows
need different columns (`code_verifier` there, `stage` and candidates here).
