# Integrations — Frontend

Part of the [Integrations module](../integrations.md): the UI shell shared by every type. Per-type forms and redirect flows live in each [type page](../integrations.md#types).

The UI shell shared by every type. Per-type forms and redirect flows live in each
[type page](../integrations.md#types). The endpoints used here are in
[Integrations routes](../../backend/routes/integrations.md).

## Menu item

- An **Integrations** item in the "My account" dropdown
  (`frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`), next to
  *Authorizations* and *Account*. It is shown only when logged in, like the rest of the dropdown.
- It links to `#/account/integrations`, following the existing `#/account/...` hash routes.
  Tent's catch-all redirect (`/path → /#/path`) makes `/account/integrations` work too.
- Visiting the page while logged out behaves like the other `#/account/...` pages.

## Page

The page is `frontend/assets/js/components/resources/accounts/pages/Integrations.jsx`.

- Loads the list with `POST /integrations/mine.json` on mount.
- **Loading** state while the list loads.
- **Empty** state: explains what integrations are for, with an "Add integration" action.
- **Error** state: shows the standard error message, with a retry action.
- After any successful action, the affected row is updated from the response (or the list is
  reloaded); no stale status is shown.

## List columns

| Column | Content |
|---|---|
| Label | `label`. |
| Type | Human name of `type` (Personal Access Token, OAuth App, GitHub App). |
| GitHub account | `githubLogin`. When two of the user's integrations share the same login, a small hint says so. |
| Status | `status` as a badge; for `invalid`, the `statusReason` shown as text (from the type's reason texts, see [Status reason codes](type-contract.md#status-reason-codes)). `undecryptable` explains the stored credential can't currently be read: the user can test it again (it recovers if the key was fixed), replace it, or remove it. |
| Credential | `secretHint` (e.g. `ghp_…a1b2`), or "unavailable" when `null`. |
| Expiry | `expiresAt`, or "no expiry". **Expiring soon** flag when `expiresAt` is within **7 days** and the status is not already `expired`. |
| Last tested | `lastTestedAt` (relative time) and `lastTestResult` (success, rejected, transient error, undecryptable), or "never". |
| Actions | See below. |

## Actions

Every action shows API errors using the standard error format: the message, with known codes
from the [error codes](../../backend/routes/integrations.md#error-codes) mapped to friendly text
(e.g. `INTEGRATION_LABEL_TAKEN`, `INTEGRATIONS_LIMIT_REACHED`, `INTEGRATION_CREDENTIAL_LOCKED`,
`GITHUB_UNAVAILABLE`).

- **Add:** opens the [type picker](#type-picker), then the chosen type's flow: a
  credential-paste form posting to `POST /integrations.json` with a label field, or the type's
  redirect start. When the cap is reached the action still opens, and the API's error is shown.
- **Rename:** inline or modal edit of the label, `PATCH /integrations/:uuid.json`.
- **Replace credential:** the type's credential form (or redirect flow) for an existing row,
  `POST /integrations/:uuid/credential.json`. Offered for every status, and highlighted for
  `invalid`, `expired` and `undecryptable`.
- **Remove:** asks for confirmation (naming the label), then `DELETE /integrations/:uuid.json`.
- **Test connection:** `POST /integrations/:uuid/test.json`, then shows the new status and
  result. The "Test" button is **disabled during the cooldown**: until `nextTestAt` (enabled
  when it is `null` or not after now), and, after a 429, for the `Retry-After` seconds.

## Type picker

- Lists the three types: Personal Access Token (`pat`), OAuth App (`oauth_app`) and GitHub App
  (`github_app`), each with a one-line description.
- Each type contributes its own form or redirect flow, defined in its type page.
- The picker lists only the types returned by `POST /integrations/types.json`
  ([enabled types](../../backend/routes/integrations.md#enabled-types)), intersected with the types
  the frontend implements. Types disabled on this server are hidden, so the picker only offers
  working flows.

## Credential input rules

- Credential inputs are `type="password"` with `autocomplete="off"`.
- The credential is cleared from component state after submit, on success **and** on failure.
- It is never written to `console`, `localStorage`/`sessionStorage`, or the URL (including the
  hash route).
- The label input is a plain text input; only credential fields follow these rules.
