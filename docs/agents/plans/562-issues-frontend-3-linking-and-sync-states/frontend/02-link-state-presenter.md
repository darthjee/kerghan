# Link state presenter

`linkStatePresenter.js` is a pure function from `(link, repositoryStatus, now)` to what the panel shows. It contains no React, so every row of the state table becomes a plain unit spec.

- **Primary message** for each row of the `linking-and-sync.md` state table, keyed by `state` and `reason`:
  - linked: "Linked to GitHub #N · last synced X ago"
  - pending
  - rate_limited
  - repository_unavailable, with the `#/repositories` link
  - sync_failed with each of `retries_exhausted`, `no_credential`, `credential_invalid` and `forbidden`, the three credential sentences carrying the "Fix it in Integrations" link (E18 to E21)
  - gone with `deleted` (E1) and `moved` (E2)

  The rate-limit wait is E17. The credential sentences are exported for the error map (step 01).
- **Secondary lines:** the other entries of `states`, each with its own message.
- **Last synced:** "last synced X ago" for every linked, non-`gone` state, plus "(may be out of date)" when `stale` is true. The relative time comes from a small `relativeTime(from, now)` helper. Reuse the repositories formatter if it fits.
- **Rate-limit time:** "sync resumes at HH:MM (in N min)" in local time. A `null` or past `rateLimitedUntil` reads "Sync should resume shortly." (U7).
- **Actions:**
  - A `gone` primary state gets `['unlink']`.
  - `repository_unavailable` anywhere in `states` removes Refresh and Retry sync, and a `sync_failed` reason stays visible.
  - `sync_failed` gets `['retrySync', 'unlink']`.
  - Every other state gets `['refresh', 'unlink']`.
- **Unlinked view:** "Not linked to GitHub" with `canAttach` true only when the project has a repository whose status is not `unavailable`. Otherwise the hint is "Connect a repository to link issues" or "The project's repository is unavailable".
- **Ticker:** a `LinkClockTicker` (modelled on `RefreshCountdown.js`) re-renders every 30 s, so the relative times stay current. It is disposed on unmount.

## Files to Change
- `frontend/assets/js/components/resources/issues/link/linkStatePresenter.js` (new)
- `frontend/assets/js/components/resources/issues/link/relativeTime.js` (new, unless an existing formatter fits)
- `frontend/assets/js/components/resources/issues/link/LinkClockTicker.js` (new)
- specs for each, with one `it` per state-table row tagged with its E-id, plus U7 and every action rule
