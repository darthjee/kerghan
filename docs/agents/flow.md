# Flow

## Status

This is the target design agreed on so far, not yet implemented — there are no models, routes,
or components for any of this yet (see `docs/agents/product.md`). Treat it as the shape to build
toward, and update it as decisions change.

## Overview

Kerghan's backend stays deliberately thin: it owns account/login state and each user's repo
selection, nothing about issue data. Issue fetching happens live, on demand, straight from the
user's own browser to GitHub's public API — this is what lets the backend "go back to sleep"
between visits instead of running a poller, and it moves GitHub's unauthenticated rate limit
(60 requests/hour/IP) from being shared across every Kerghan user behind the backend's one IP to
being scoped to each user's own browser IP instead.

## Step by step

1. **Login.** The user logs into Kerghan itself (a lightweight, backend-owned session — not
   GitHub OAuth). For now, "login" just means giving the backend a GitHub handle; there's no
   password or identity verification behind it yet. A per-user GitHub token, to unlock private
   repos, is planned as a future addition — not built yet, and not required for the public-repo
   flow described here.

2. **Repo discovery.** The backend fetches the full list of the handle's public repositories
   from GitHub (`GET /users/{handle}/repos`, paginated) and shows it to the user.

3. **Repo selection.** The user picks which repos to monitor. This selection — not any issue
   data — is what the backend persists to MySQL, scoped to the user's account.

4. **Returning to the dashboard.** On every visit, the frontend loads the user's saved repo
   selection from the backend. This is the one piece of state that's genuinely per-user and
   worth serving fast; see "Per-user cache" below for how that read path is expected to evolve.

5. **Issue fetching (live, on demand).** With the repo list in hand, the frontend calls GitHub's
   public REST API directly (client-side, no backend involved) to fetch issues for each selected
   repo, and holds them in memory for that page view. Nothing about issue data is written to
   MySQL by default.

6. **Refresh.** There is no auto-refresh/polling. The user must explicitly hit a refresh action
   in the frontend to redo the GitHub fetch. Given Kerghan's expected user count is very small,
   a single user re-fetching too often only affects their own rate-limit budget, not anyone
   else's.

## Deliberately deferred

These are known future directions, not part of the current design:

- **Opt-in issue persistence.** Nothing about issue history/trends is stored today. If a user
  wants to look back over time, persisting fetched issues (only when the user opts in) is a
  future addition — see `docs/agents/product.md`.
- **Historical/trend collection.** Volume-over-time or similar trend views need periodic
  snapshotting, which depends on the opt-in persistence above. Not built yet.
- **Private repos via personal GitHub token.** Each user will eventually be able to attach their
  own GitHub token so the frontend (or backend, depending on how this is designed) can read
  private repos on their behalf. Not built yet.

## Per-user cache (upcoming)

The repo-selection read path (step 4) is user-scoped, so per the current architecture it must
bypass Tent's shared HTTP cache (`X-Skip-Cache` — see
[Cache Warmer](cache-warmer.md#per-user-cache-upcoming)). A per-user cache layer is in active
development on Tent itself and is expected to take over this read path once available — update
this section and `cache-warmer.md` together once that lands.

## Open questions

- Exact session mechanism behind "login" (cookie? something else?) is not yet decided.
- Whether repo selection is refreshed periodically or only re-fetched on explicit user action.
