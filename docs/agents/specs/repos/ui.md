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
  `POST /repositories/sync/state.json` at a fixed interval. It stops on `idle` (then reloads the
  current listing page), on unmount, or on `401`; a transient error (network, `5xx`) keeps
  polling.
- **Refresh button:**
  - while syncing, it is disabled and reads "Syncing…";
  - inside the cooldown (`refreshAvailableAt` in the future), it is disabled, with the tooltip
    and accessible label **"Refresh available in 2m 34s"**, counting down from
    `refreshAvailableAt`; it re-enables at zero;
  - on a `429` anyway (race, clock skew), an inline notice **"Repositories were synced recently.
    Try again in N s."** from `retryAfterSeconds`, and the countdown adopts it.

> **Open — settled by #447:** the sync-state polling interval (a frontend constant).

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

A new "GitHub handle" input on the existing Account page (`#/account/my-account`), editable by
the default user too ([model.md](model.md#github-handle)).

> **Open — settled by #449:** the field's validation messages, and whether admin pages show or
> edit the handle.

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
- Polling runs while `syncing`, stops on `idle` / unmount / `401` (reloading the page on
  `idle`), and keeps going on a transient error.
- The Refresh countdown follows `refreshAvailableAt`; Refresh is disabled while syncing; a `429`
  shows the cooldown notice and the countdown adopts `retryAfterSeconds`.
- Each banner text maps to its status; `ok` and `pending` show none; only `invalid_credentials`
  links to Integrations, and the handle banner never does.
- With no handle and no integration, the empty state links to Account and Integrations.
- The Account page shows the GitHub handle field, editable by the default user.
- No frontend request goes to GitHub.
