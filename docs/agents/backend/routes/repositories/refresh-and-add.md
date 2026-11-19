# Repositories routes — Refresh and Add

The Refresh and Add routes and the Add rate limit. Back to the [Routes — Repositories](../repositories.md) hub.

## Refresh

`POST /repositories/sync.json`, no body. Forces a sync of every source.

| Case | Answer |
|---|---|
| Idle, outside the cooldown | Starts a sync; **`202 Accepted`** with the sync-state object (`state: "syncing"`). |
| A sync already running (any trigger) | **`202`** with the current sync state; no second sync, the cooldown is not reset. Idempotent, so repeated clicks are harmless. |
| Idle, inside the cooldown | **`429`** `REPOSITORY_REFRESH_COOLDOWN`, `Retry-After: <seconds>` (rounded up), standard error shape. |
| No sources (no integrations, no handle) | `202`; the sync completes at once with an empty `sources` list; the UI shows its empty state. |

- Order of checks: `OriginGuard`, then `JwtGuard` (as for every route: a cross-site request
  without a session answers `403`), then "already syncing", then "cooldown", then start.
- **The cooldown runs from the start of the last sync, whatever triggered it** (stale listing or
  Refresh). It protects the GitHub budget, notably the shared unauthenticated 60/h.
  `refreshAvailableAt` follows the same rule; the duration is 5 min
  ([sync](../../../modules/repositories/sync/github-limits.md#values)).
- "Already syncing" and "cooldown" are one atomic claim ([sync](../../../modules/repositories/sync/execution.md#per-user-lock)), so
  concurrent Refreshes start one sync.
- Refresh runs every source; there is no per-source refresh. A `rate_limited` source is skipped
  while its `resetAt` is in the future: no GitHub call, its status, `resetAt` and rows are kept
  ([sync](../../../modules/repositories/sync/github-limits.md#rate-limits)).

## Add

`POST /repositories/add.json`, body = a [repo ref](identity-and-sync.md#repo-ref). Marks a repository of the caller's
listing as added.

| Step | Check | Failure answer |
|---|---|---|
| 1 | DTO: exactly one of `githubId` / `fullName`, well formed | `400 VALIDATION_FAILED` |
| 2 | Per-user Add rate limit | `429 REPOSITORY_ADD_RATE_LIMITED` + `Retry-After` |
| 3 | Ref looked up in the **caller's own rows**, by `user_id` from the session in the query itself | `404 NOT_FOUND`, no GitHub call, no write |
| 4 | Already added | **`200`** with the current row: idempotent, no GitHub call, no write; the original `addedAt` and access link are kept |
| 5 | GitHub re-check: one request for that repository, through the chosen access integration ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#access-link-on-add)) | **No candidate** before any GitHub call (every source holding the repo is a non-usable integration, and the handle source does not hold it): `409 REPOSITORY_SOURCE_UNUSABLE`, no GitHub call, nothing written. Denied (`404`/`403` from every candidate called): `404 NOT_FOUND`, nothing written. Unauthenticated low budget, or a GitHub rate limit: `503 GITHUB_RATE_LIMITED` + `Retry-After` when known (never `404`, nothing marked `invalid`). Timeout / `5xx`: `502 GITHUB_UNAVAILABLE`. |
| 6 | Write, conditional: `UPDATE … SET added_at, integration_id, snapshot WHERE id = :id AND user_id = :userId AND added_at IS NULL` | **`200`** with the updated row (listing row shape, `status: "added"`). Zero rows ⇒ re-read the row (`WHERE id = :id AND user_id = :userId`): **added** ⇒ `200` with the current row (a concurrent Add won: its `addedAt` and link are kept); **missing** ⇒ `404 NOT_FOUND` (pruned meanwhile). |

- `200`, not `201`: the row already existed; Add only marks it.
- **The stored link is always the caller's own:** an `integration_id` that is not one of the
  caller's integrations at write time is stored as `null` (filled by the next sync's link fill),
  never another user's id ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#access-link-on-add)).
- **Owner lookup first:** a missing row, including one only another user holds, answers the same
  `404` as a GitHub denial, with no GitHub call and no write. Only repos already in the user's own
  listing can be added.
- **Rate limit before the lookup:** every attempt past validation counts, so the limit bounds both
  the GitHub budget and probing; a `404` reveals nothing, since the lookup covers only the
  caller's own rows.
- **The re-check is built only from the stored row** (its `github_id`, or its stored
  `owner`/`name` URL-encoded), never from the request's `fullName`, so no user input reaches the
  GitHub API path ([security](../../../modules/repositories/security.md#fixed-github-base-url)).
- When only the public source sees the repo, the re-check goes through a usable integration if the
  user has one (without linking it), and unauthenticated otherwise. If that re-check shows the
  repo has become **private**, the integration that granted it is linked as `integration_id`, so
  the stored private metadata stays tied to the integration that granted it
  ([data model](../../../modules/repositories/data-model.md#private-metadata-lifecycle)) and the row reads as Added, not
  Unavailable.
- The unauthenticated re-check goes through the shared process-wide budget tracker with **Add's
  own threshold**: it is refused only when the remaining budget is **≤ 0** (the sync stops at
  ≤ 10, keeping a reserve for Add), answering `503` with no GitHub call
  ([sync](../../../modules/repositories/sync/github-limits.md#rate-limits)).
- **Race with pruning:** the write is `UPDATE … WHERE id = :id AND user_id = :userId AND
  added_at IS NULL`. If a sync's pruning deleted the not-added row first, the update affects no
  row, the re-read finds nothing, and Add answers `404 NOT_FOUND` (the repo left the listing); if
  Add commits first, pruning skips the row ([data model](../../../modules/repositories/data-model.md#private-metadata-lifecycle)).
- **Double Add:** two concurrent Adds of the same repo both pass step 4. Only one write matches
  `added_at IS NULL`; the other affects no row, re-reads the row as added and answers `200` with
  the first Add's `addedAt` and access link. The losing request's GitHub call is wasted, which the
  per-user Add rate limit bounds.
- **`409 REPOSITORY_SOURCE_UNUSABLE`:** decided after the rate limit and the lookup in the
  caller's own rows, only from the caller's own sources, so it reveals nothing about other users
  or about GitHub ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#add-re-check-candidates)). Once at least one
  candidate was called and every one denied the repo, or the 3-call cap was reached, the answer
  stays `404 NOT_FOUND`.
- `502 GITHUB_UNAVAILABLE` and `503 GITHUB_RATE_LIMITED` reuse the existing codes and helpers,
  moved to `core/github-http-errors.ts` ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#shared-502--503-helpers)).
- **Candidate walk** ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#add-re-check-candidates)), at most **3
  GitHub calls** per Add: first the usable integrations holding a source row for the repo, oldest
  first; then, when the handle source sees it, the remaining usable integrations, oldest first,
  then unauthenticated. A `401` (which also marks a `pat` / `oauth_app` integration `invalid`),
  `403` or `404` moves to the next candidate; a rate limit, timeout, `5xx` or redirect stops the
  walk (`503` / `502`, no fallback). No candidate left, or the cap reached, after denials ⇒
  `404 NOT_FOUND`. No candidate at all before any call ⇒ `409 REPOSITORY_SOURCE_UNUSABLE`.

### Add rate limit

Per user, **30 Adds per 60 s** by default. The limit is an **in-memory, per-process fixed window**
per user (`RepositoryAddRateLimiter`), read through the shared `Clock`, with no table and no
migration: it resets on a restart, and each backend instance counts on its own. Expired windows
are swept, so idle users do not stay in memory.

| Env var | Default | Meaning |
|---|---|---|
| `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW` | `30` | Adds allowed per user per window. |
| `KERGHAN_REPOSITORIES_ADD_WINDOW_MS` | `60000` | Window length in milliseconds. |

Both are read once with `getNumberConfig` (in `repositories-config.ts`; a non-positive or
non-integer value falls back to the default), and are listed in
`docs/agents/environment-variables.md`.

