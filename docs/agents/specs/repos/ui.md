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

- `owner/name`, linking to the repository on GitHub;
- a visibility badge (public / private);
- source badges: the integration labels and/or "public" that can see it;
- the status: **Added**, **Not added**, **Unavailable** or **Unknown**
  ([model.md](model.md#row-statuses));
- on not-added rows, an **Add** button: a spinner while the request runs, the row turns
  **Added** on success, an inline error on failure (e.g. the `404` when GitHub no longer grants
  access).

## Toolbar

- A filter: **All** (default), **Added**, **Not added**, **Unavailable**.
- A name search.
- A **Refresh** button.
- A "last synced X ago" label.
- Pagination controls under the table, driven by the paginated listing.

## Sync UX

- Stored rows show immediately, with a "Syncing with GitHub…" indicator while a sync runs.
- The page reloads its rows when the sync ends.
- Only the very first sync (nothing stored yet) shows a full spinner.

> **Open — settled by #446 and #447:** the message shown when Refresh is refused by the cooldown
> (`429`), and the sync-state polling interval.

## Source errors

A dismissible banner per failed source (e.g. "Integration *work-pat* failed: invalid
credentials"), linking to the Integrations page (`#/account/integrations`).

## Empty state

With no GitHub handle and no integration, the page explains both options and links to
**Account** (`#/account/my-account`, to set the handle) and **Integrations**.

## GitHub handle field

A new "GitHub handle" input on the existing Account page (`#/account/my-account`), editable by
the default user too ([model.md](model.md#github-handle)).

> **Open — settled by #449:** the field's validation messages.

## Edge cases

> **Open — settled by #450:** UI edge cases (e.g. a row changing status during a sync, a page
> emptied by a sync).

## Required tests

Tests for the open points above, including the frontend spec strategy (#451), are added by the
issue that settles them.

- The Repositories link shows for a logged-in user and is hidden while awaiting approval.
- Each row renders `owner/name` linked to GitHub, visibility, sources and status.
- Add shows a spinner, turns the row Added on success, and shows an inline error on failure.
- The filter defaults to All; filter, search and pagination drive the listing request.
- Stored rows show with the syncing indicator; rows reload when the sync ends; the full spinner
  shows only on the first sync.
- A failed source shows a dismissible banner linking to Integrations.
- With no handle and no integration, the empty state links to Account and Integrations.
- The Account page shows the GitHub handle field, editable by the default user.
- No frontend request goes to GitHub.
