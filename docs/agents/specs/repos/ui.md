# Repositories — UI

The frontend of the Repositories feature. Part of the [Repositories specs](README.md).

Conventions to follow: hash routes in `frontend/assets/js/utils/routing/HashRouteResolver.js`,
the navbar in `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`, and the
Integrations page under `frontend/assets/js/components/resources/accounts/pages/` for the table
layout.

The frontend never calls GitHub for this feature: it only talks to Kerghan's API
([api.md](api.md)).

## Placement

A top-level **Repositories** link in the navbar, to `#/repositories`, shown to every logged-in
user and hidden while the account awaits approval, like the rest of the logged-in menu.
Repositories are the core product, not an account setting.

## Table

One row per repository:

- `owner/name`, linking to the repository on GitHub. The frontend builds the link as
  `https://github.com/` + URL-encoded `owner` + `/` + URL-encoded `name`; it never renders a
  GitHub-supplied URL;
- a visibility badge (public / private);
- source badges from the row's `sources[]`: the integration label, or the GitHub handle;
- the status: **Added**, **Not added**, **Unavailable** or **Unknown**
  ([model.md](model.md#row-statuses));
- on not-added rows, an **Add** button (sending the row's `githubId`): a spinner while the
  request runs, the row turns **Added** on success, an inline error on failure.

Inline Add errors, shown on the row ([api.md](api.md#add)):

| Answer | Message |
|---|---|
| `404` | "Repository not found on GitHub." |
| `502` / `503` | "GitHub is unavailable or rate limited — try again later." |
| `429` | "Too many repositories added — try again in N s." (N from `retryAfterSeconds`) |

## Toolbar

- A filter: **All** (default), **Added**, **Not added**, **Unavailable**. **Unknown** rows show
  only under All, on purpose (the list fixed by #444).
- A name search.
- A **Refresh** button.
- A "last synced X ago" label.
- Pagination controls under the table, driven by the paginated listing.

## Sync UX

- Stored rows show immediately, with a "Syncing with GitHub…" indicator while a sync runs.
- Only the very first sync (`lastSyncedAt` is `null`) shows a full spinner.
- **Polling** ([api.md](api.md#polling-contract)): while `state` is `syncing`, the page polls
  `POST /repositories/sync/state.json` every **2 s** (a frontend constant,
  [sync.md](sync.md#values)). It stops on `idle` (then reloads the
  current listing page), on unmount, or on `401`; a transient error (network, `5xx`) keeps
  polling.
- **Refresh button:**
  - while syncing, it is disabled and reads "Syncing…";
  - inside the cooldown (`refreshAvailableAt` in the future), it is disabled, with the tooltip
    and accessible label **"Refresh available in 2m 34s"**, counting down from
    `refreshAvailableAt`; it re-enables at zero;
  - on a `429` anyway (race, clock skew), an inline notice **"Repositories were synced recently.
    Try again in N s."** from `retryAfterSeconds`, and the countdown adopts it.

## Source errors

A dismissible banner per source whose `status` is not `ok` or `pending`
([api.md](api.md#sync-state)). `<source>` is *integration "work-pat"* or *GitHub handle
"darthjee"*.

| Status | Banner |
|---|---|
| `invalid_credentials` | `<source>` failed: invalid credentials. **Fix it in Integrations** (link to `#/account/integrations`) |
| `rate_limited` | `<source>` hit GitHub's rate limit; it will retry after `<resetAt, local time>`. |
| `page_cap_reached` | `<source>` has more repositories than Kerghan reads; some may be missing. |
| `error` | `<source>` could not be read from GitHub; its repositories may be out of date. |

The handle source never links to Integrations.

## Empty state

With no GitHub handle and no integration, the page explains both options and links to
**Account** (`#/account/my-account`, to set the handle) and **Integrations**.

## GitHub handle field

A new **GitHub handle** section on the existing Account page (`#/account/my-account`), separate
from the username / email / password form, with its own input and **Save** button
([model.md](model.md#github-handle)).

- **Prefill:** on load the page calls `POST /auth/account/mine.json` and fills the input with
  `githubHandle` (empty when `null`). While it loads, the section's input and button are
  disabled; if it fails, the section shows "Could not load your GitHub handle." and stays
  disabled. The username / email / password form is unchanged (still not prefilled).
- **Help text:** "Your public GitHub repositories are listed on the Repositories page. Leave
  empty to remove it."
- **Save** sends `PATCH /auth/account.json` with only `{ githubHandle }`: the trimmed value, or
  `null` when empty. No current-password field in this section, so it works for the default user
  (who usually cannot know its password); the main form never sends `githubHandle`, so the two
  never mix.
- **Client-side validation** mirrors the server's after the same normalisation (trim, one
  leading `@`, lowercase): an invalid value shows the inline field error **"Use letters, digits
  and single hyphens (max 39 characters)."** and sends nothing.
- **Server errors** show as the section's own submit alert with `error.message` (the existing
  `FormFieldsHelper` pattern); a `401` follows the app's usual session handling.
- **Success:** the input takes the response's `githubHandle` (so `@DarthJee` shows as
  `darthjee`), with "GitHub handle updated." or, when cleared, "GitHub handle removed.".
- **Admin pages** (`#/admin/users`, `#/admin/users/:id/edit`) are unchanged: no handle column, no
  handle field.

## Edge cases

> **Open — settled by #450:** UI edge cases (e.g. a row changing status during a sync, a page
> emptied by a sync, a handle source reporting `invalid_credentials` because it went through an
> integration, whose banner has no Integrations link).

## Required tests

Tests for the open points above, including the frontend spec strategy (#451), are added by the
issue that settles them.

- The Repositories link shows for a logged-in user and is hidden while awaiting approval.
- Each row renders `owner/name` linked to `https://github.com/<owner>/<name>` (URL-encoded),
  visibility, sources and status.
- Add shows a spinner, turns the row Added on success, and shows the inline error matching
  each answer (`404`, `502`/`503`, `429`).
- The filter defaults to All; filter, search and pagination drive the listing request.
- Stored rows show with the syncing indicator; the full spinner shows only on the first sync.
- Polling runs every 2 s while `syncing`, stops on `idle` / unmount / `401` (reloading the page on
  `idle`), and keeps going on a transient error.
- The Refresh countdown follows `refreshAvailableAt`; Refresh is disabled while syncing; a `429`
  shows the cooldown notice and the countdown adopts `retryAfterSeconds`.
- Each banner text maps to its status; `ok` and `pending` show none; only `invalid_credentials`
  links to Integrations, and the handle banner never does.
- With no handle and no integration, the empty state links to Account and Integrations.
- The Account page shows the GitHub handle section, prefilled from
  `POST /auth/account/mine.json` (empty for `null`), disabled while loading, with the load-error
  text on failure.
- Saving sends only `{ githubHandle }` (no `currentPassword`), `null` for an empty input; the
  input then shows the response's normalised value and the matching success message.
- An invalid handle shows the inline error and sends no request; `@name` and mixed case pass
  client-side validation.
- A server error shows `error.message` in the section's alert.
- The username / email / password form never sends `githubHandle`.
- The section works for the default user (no password asked).
- The admin user list and edit pages show no handle.
- No frontend request goes to GitHub.
