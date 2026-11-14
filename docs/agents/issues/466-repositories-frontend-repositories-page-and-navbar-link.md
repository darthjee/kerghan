# Issue: Repositories: Frontend — Repositories page and navbar link

## Description

Part of Epic #444 (repositories listing), implementation slice **G**, the last implementation slice. It adds the **Repositories page** at `#/repositories`: a top-level navbar link and a paginated table of the user's GitHub repos. Each row is marked **Added**, **Not added**, **Unavailable** or **Unknown**, and not-added rows have an **Add** button.

Spec: `docs/agents/specs/repos/ui.md`, every section except `#github-handle-field` (done in #465). The API contract comes from `api.md` (`#listing`, `#sync-state`, `#polling-contract`, `#refresh`, `#add`, `#errors`), with `testing.md#frontend` for the test layers and `edge-cases.md#ui` for the UI edge-case matrix.

**Depends on:** #464 (Repositories API routes) and #465 (GitHub handle field), both merged.
**Blocks:** #452 (fold the specs into the permanent docs).

## Problem

The backend now serves the listing, sync state, Refresh and Add (`POST /repositories/{mine,sync/state,sync,add}.json`), and the user can set a GitHub handle, but there is no page to see or use the repositories.

## Expected Behavior

- **Route and navbar** (`ui.md#placement`): a hash route `#/repositories`, and a top-level **Repositories** navbar link, shown to every logged-in user and hidden while the account awaits approval (like the rest of the logged-in menu). It is not inside the "My account" dropdown.
- **Table** (`ui.md#table`), one row per repository:
  - `owner/name`, linked to `https://github.com/` + URL-encoded `owner` + `/` + URL-encoded `name`. No GitHub-supplied URL is ever rendered;
  - a public / private badge;
  - source badges, matched by key with the sync state's `sources[].status`. A source that is not `ok` (or `page_cap_reached`) is **muted**, with the tooltip and accessible label "<source> could not be refreshed". A `pending` source reads "<source> has not been synced yet";
  - the status;
  - an **Add** button on not-added rows. It sends `{ githubId }`, shows a spinner while the request runs, and turns the row Added on success. On failure it shows the inline error from the `ui.md#table` table: `404`, `502`/`503`, `409 REPOSITORY_SOURCE_UNUSABLE` (with an Integrations link) and `429` (with N from the retry delay).
- **Toolbar** (`ui.md#toolbar`):
  - a filter: All (the default), Added, Not added, Unavailable. Unknown rows show only under All;
  - a name search;
  - a Refresh button;
  - a "last synced X ago" label;
  - pagination under the table, driven by the listing's `pagination`.
- **Sync UX** (`ui.md#sync-ux`):
  - stored rows show at once, with a "Syncing with GitHub…" indicator while a sync runs. The full spinner shows only on the first sync (`lastSyncedAt` is `null`);
  - while `syncing`, the page polls `POST /repositories/sync/state.json` every **2 s** (a frontend constant). Polling stops on `idle` (then reloads the current page), on unmount, or on `401`. A transient error (network, `5xx`) keeps it polling;
  - Refresh is disabled and reads "Syncing…" while syncing;
  - inside the cooldown, Refresh is disabled with "Refresh available in 2m 34s", counting down from `refreshAvailableAt`;
  - a `429` on Refresh shows "Repositories were synced recently. Try again in N s.", and the countdown adopts the retry delay.
- **Source errors** (`ui.md#source-errors`): a dismissible banner per source whose status is not `ok` or `pending`, with the texts and links of the status table:
  - only integration sources show `invalid_credentials`, with an Integrations link;
  - `not_found` is for the handle only and links to the Account page;
  - the handle banner never links to Integrations.
- **Empty states** (`ui.md#empty-state`):
  - no source at all: the page explains both options and links to Account and Integrations;
  - sources but no repos: "No repositories found. Check the sources above.";
  - a filter or search with no match: "No repositories match your filters.".
- **UI edge cases** (`ui.md#edge-cases`), all ten:
  - an empty page above 1 after a reload jumps to the last page and reloads once;
  - rows stay frozen while syncing;
  - Add state is kept by `githubId` across a reload;
  - an Added row stays visible under "Not added" until the next reload or filter change;
  - a pruned row's `404` shows the inline error, and the row is gone after the next reload;
  - banner dismissal is kept in memory per (source, status, `syncedAt`), with no `localStorage`;
  - a deleted integration's badges and banner disappear on reload;
  - the remaining three are covered by the banner and empty-state rules above.
- **Retry delay in the client:** `ApiError` gains `retryAfterSeconds`, read from the body's `error.retryAfterSeconds` and falling back to the `Retry-After` header. The existing `retryAfter` (used by Integrations) keeps working unchanged.
- **Backend only:** the frontend never calls GitHub. A static spec asserts that no frontend source contains `api.github.com`.
- **Tests:** every remaining item of `ui.md#required-tests` (the handle-field items were done in #465), in the three Jasmine layers of `testing.md#frontend`:
  - a `RepositoriesClient` client spec, with `fetchSequence`;
  - controller specs, with a harness like `integrationsControllerHarness.js` (fixed `NOW`, `jasmine.clock()`, `flushMicrotasks`);
  - render specs, with `elementTree` / `renderedOutput`;
  - shared builders `buildRepository`, `buildSyncState` and `buildSource` in `frontend/specs/support/`.

## Solution

Frontend only (`frontend/`), following `ui.md` section by section and its "Required tests":

- a new `RepositoriesClient` (in `frontend/assets/js/client/`) with `list({ page, perPage, filter, search })`, `syncState()`, `refresh()` and `add(githubId)`, all `POST` to Kerghan's API base;
- the `retryAfterSeconds` addition in `ApiClient` / `ApiError`;
- the `#/repositories` route in `HashRouteResolver.js` and the navbar link in `HeaderHelper.jsx`;
- the page, with a controller holding the polling, the countdown, the Add state and the banner dismissals, and helpers for the rendering, in the style of the Integrations page.

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in.
- Every test this slice owns, as listed in the "Required tests" sections named above, is written and passes; tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`.
