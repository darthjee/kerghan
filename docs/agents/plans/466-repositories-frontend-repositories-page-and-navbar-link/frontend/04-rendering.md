# 04 — Page rendering

The page component and pure render helpers, in the style of `IntegrationsHelper` / `IntegrationsTableHelper`.

- `Repositories.jsx`: `useState` for each piece of state, a `useMemo` controller, and `buildLoadEffect(controller)` (load on mount, `dispose()` on unmount), then `RepositoriesHelper.render(state, handlers)`.
- `RepositoriesHelper.jsx`: the page layout, in order — source-error banners, toolbar, then the full spinner (first sync only: `lastSyncedAt === null` while syncing) or the "Syncing with GitHub…" indicator above the stored rows, then table or empty state, then pagination.
- `RepositoriesToolbarHelper.jsx`: the filter (All / Added / Not added / Unavailable; no Unknown option), the name search, Refresh ("Syncing…" and disabled while syncing; disabled with tooltip + `aria-label` "Refresh available in 2m 34s" inside the cooldown), the `429` notice, and "last synced X ago" (or nothing before the first sync).
- `RepositoriesTableHelper.jsx`: per row, the `owner/name` link (`https://github.com/` + URL-encoded `owner` + `/` + URL-encoded `name`, `target="_blank" rel="noopener noreferrer"`), the public / private badge, source badges (the label or the handle; muted with "<source> could not be refreshed" when the matching status is not `ok`/`page_cap_reached`; "<source> has not been synced yet" when `pending`), the status label (Added / Not added / Unavailable / Unknown), and on not-added rows the Add button, its spinner and its inline error (with the Integrations link for `409`).
- `SourceBannersHelper.jsx`: one dismissible `Alert` per source whose status is not `ok`/`pending`, with the texts of `ui.md#source-errors`: `<source>` reads *integration "work-pat"* or *GitHub handle "darthjee"*; `resetAt` in local time for `rate_limited`; the Integrations link only for an integration's `invalid_credentials`; the Account link (`#/account/my-account`) for `not_found`.
- `RepositoriesEmptyStateHelper.jsx`: no source (no handle, no integration: `sync.sources` empty) explains both options with links to `#/account/my-account` and `#/account/integrations`; sources but no repos after a finished sync with no filter/search: "No repositories found. Check the sources above."; filter or search with no match: "No repositories match your filters.".
- Pagination with react-bootstrap `Pagination`, driven by `pagination.page` / `totalPages`, hidden for a single page.
- **Static spec:** a spec that walks every file under `frontend/assets/` (with `fs`, as other static specs do, or a new one) and asserts none contains `api.github.com`.

## Files to Change
- `frontend/assets/js/components/resources/repositories/pages/Repositories.jsx` — new.
- `frontend/assets/js/components/resources/repositories/pages/helpers/{RepositoriesHelper,RepositoriesToolbarHelper,RepositoriesTableHelper,SourceBannersHelper,RepositoriesEmptyStateHelper}.jsx` — new.
- `frontend/specs/assets/js/components/resources/repositories/pages/RepositoriesSpec.js` — mount effect loads and disposes.
- `frontend/specs/assets/js/components/resources/repositories/pages/helpers/*Spec.js` — with `elementTree` / `renderedOutput` and the builders: the URL-encoded link (e.g. an owner/name with a space or `#`), visibility, muted badges and their labels, each banner text per status (none for `ok`/`pending`; only integration `invalid_credentials` links to Integrations; the handle banner never does; `not_found` links to Account), dismissed banners hidden, spinner vs indicator, Refresh states, each empty state and the no-match message, the Add button / spinner / inline errors, a deleted integration's badge gone when absent from `sources[]`.
- `frontend/specs/assets/js/noGithubApiSpec.js` — new static spec.
