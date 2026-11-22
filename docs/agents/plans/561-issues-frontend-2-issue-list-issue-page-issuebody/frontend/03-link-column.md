# Link column and state badge
This step adds a shared `components/resources/issues/link/LinkStateBadge.jsx`, which #562's link panel reuses. It maps each primary state to the badge wording and variant of the `linking-and-sync.md#link-and-sync-states` table, for example `linked` to Synced (success) and `pending` to Pending (info). It covers every row (`gone`, `sync_failed`, `repository_unavailable`, `rate_limited`, `pending`, `linked`), and an unknown state renders nothing.

It also adds `components/resources/issues/link/GithubLink.jsx`. It renders `#N` as an external link only when `url` starts with `https://github.com/`, with `rel="noopener noreferrer"` and `target="_blank"`. For any other URL it renders nothing (S2).

The list cell `IssueLinkCellHelper.jsx` shows:

- "—" when `link` is `null`
- otherwise `GithubLink`, plus `LinkStateBadge` when `state !== 'linked'`, plus a muted "stale" when `stale` is true

Specs:

- every badge row
- the unknown state
- the S2 cases: `https://github.com/` shown; `http://github.com/`, `https://github.com.evil/`, `javascript:` and an empty URL render nothing
- the cell's four shapes, using `buildLink` from `issuesBuilders.js`

## Files to Change
- `frontend/assets/js/components/resources/issues/link/LinkStateBadge.jsx` — new, shared with #562
- `frontend/assets/js/components/resources/issues/link/GithubLink.jsx` — new
- `frontend/assets/js/components/resources/issues/list/helpers/IssueLinkCellHelper.jsx` — new
- `frontend/specs/assets/js/components/resources/issues/link/` — the specs
