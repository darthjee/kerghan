# Repositories — API

The HTTP surface of the Repositories module, in the style of
[`backend/routes/`](../../backend/routes/integrations.md). Part of the
[Repositories specs](README.md). #452 folds it into `docs/agents/backend/routes/repositories.md`.

## Every route

- Routes end in `.json`; Tent forwards them to the backend.
- **Every route is `POST`**, reads included. User-scoped reads use `POST` like
  `POST /integrations/mine.json`: Tent's cache key ignores the method, so a user-scoped `GET`
  risks being cached for everyone ([caching.md](../../architecture/caching.md)). No repositories
  route answers `GET`.
- **Auth:** every route sits behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`) and
  is scoped to the caller (`req.user.sub`).
- **CSRF:** every route is `POST`, so the global `OriginGuard` covers all four
  ([security.md](security.md#csrf)).
- **Caching:** cache class **`user-scoped`** (`@CachePolicy(CacheClass.UserScoped)`,
  [caching.md](../../architecture/caching.md#cache-classes)). As for any non-`GET`, every response
  that passes the global guards (success and handler errors alike) sends `X-Skip-Cache: true`
  and `Cache-Control: no-store`. `JwtGuard` / `OriginGuard` rejections run before the interceptor
  and carry no cache headers, which is harmless since Tent caches only 2xx
  ([caching.md](../../architecture/caching.md#response-headers)). The Add rate limit runs in the
  service, after the interceptor, so its `429` carries the headers.
- **Navi:** no route is warmed; none belongs in `navi/navi_config.yaml`.
- **Errors** use the standard error format (`core/http-exception.filter.ts`); see
  [Errors](#errors).
- Controllers stay thin: validation in DTOs, everything else in the module's services.
- **Handle reconciliation first:** every route (listing, sync state, Refresh, Add) first runs the
  [handle reconciliation](model.md#handle-changes), so a changed or cleared GitHub handle's old
  rows are dropped (and pruned) before anything is read or written. The sync-state route stays a
  pure read of the sync: it never starts one.
- **Bodies** go through the global `ValidationPipe({ whitelist: true, transform: true })`:
  unknown properties are **stripped and ignored**, not rejected. A body sent to a "no body" route
  (Sync state, Refresh) is ignored.

## Routes

| Action | Route | Body | Success |
|---|---|---|---|
| [Listing](#listing) | `POST /repositories/mine.json` | `{ page, perPage, filter, search }` | `200` `{ repositories, pagination, sync }` |
| [Sync state](#sync-state) | `POST /repositories/sync/state.json` | none | `200` sync-state object |
| [Refresh](#refresh) | `POST /repositories/sync.json` | none | `202` sync-state object |
| [Add](#add) | `POST /repositories/add.json` | a [repo ref](#repo-ref): `{ githubId }` or `{ fullName }` | `200` repository row |

## Listing

`POST /repositories/mine.json`. Serves the user's rows **from the database**, never straight
from GitHub.

### Request

Every field is optional. Any invalid value answers `400 VALIDATION_FAILED`.

```json
{ "page": 1, "perPage": 50, "filter": "all", "search": "kerg" }
```

| Field | Rule |
|---|---|
| `page` | Integer ≥ 1, default `1`. A page past the end answers `200` with an empty `repositories` list. |
| `perPage` | Integer ≥ 1, default `50`, maximum `100`. |
| `filter` | `all` (default), `added`, `not_added`, `unavailable`. `unknown` is rejected: Unknown rows show only under `all`, on purpose (the filter list is the one fixed by #444). |
| `search` | Trimmed, at most 100 characters, case-insensitive **literal** substring match on `owner/name`. Empty means no search. Passed only as a bound query parameter, never concatenated into SQL; the `LIKE` metacharacters `%`, `_` and `\` are escaped (`ESCAPE '\'`), so they match literally. |

### Response

```json
{
  "repositories": [{
    "githubId": 123456,
    "owner": "darthjee", "name": "kerghan", "fullName": "darthjee/kerghan",
    "private": false,
    "status": "added",
    "addedAt": "2026-11-07T12:00:00Z",
    "lastSeenAt": "2026-11-07T12:00:00Z",
    "sources": [
      { "kind": "integration", "integration": { "uuid": "…", "label": "work-pat" } },
      { "kind": "handle", "handle": "darthjee" }
    ],
    "accessIntegration": { "uuid": "…", "label": "work-pat" }
  }],
  "pagination": { "page": 1, "perPage": 50, "total": 123, "totalPages": 3 },
  "sync": { "state": "idle", "…": "the sync-state object, see Sync state" }
}
```

| Row field | Meaning |
|---|---|
| `githubId` | GitHub's repository id, the canonical key ([Repository identity](#repository-identity)). |
| `owner`, `name`, `fullName` | From the latest snapshot; `fullName` is `owner/name`. |
| `private` | Visibility. |
| `status` | `added`, `not_added`, `unavailable` or `unknown`, derived on read ([model.md](model.md#row-statuses)). |
| `addedAt` | `null` for not-added rows. |
| `lastSeenAt` | When a source last returned the repo. |
| `sources[]` | Every **current** source holding a row for the repo, as of that source's last applied page, failed and `pending` sources included ([model.md](model.md#repositories_sources)): `{ kind: "integration", integration: { uuid, label } }` or `{ kind: "handle", handle }` (`handle` is the current, normalised, lowercase handle, [model.md](model.md#normalisation)). The UI matches each entry by key with the sync state's `sources[].status` and mutes a source that is not `ok` ([ui.md](ui.md#table)). |
| `accessIntegration` | The access link set on Add, as `{ uuid, label }`. `null` for not-added rows, for added rows only the public source sees, and for a dangling link (its integration was deleted). |

- **Sort:** fixed, case-insensitive `owner`, then `name`, then `githubId`, so pages are stable.
  No sort parameter.
- **Pagination:** page-based with totals (`page`, `perPage`, `total`, `totalPages`). `total` and
  `totalPages` count the rows matching `filter` and `search`; counts are cheap at per-user scale.
- `sync` is the same object as the [Sync state](#sync-state) route returns.

### Stale-sync trigger

The listing starts a sync when the user's last one is stale ([sync.md](sync.md#trigger); TTL
1 h, [sync.md](sync.md#values)). The server owns the staleness rule; the frontend makes one call. The listing returns
the stored rows at once, with `sync.state` already `syncing` when it started one. A fresh listing,
or one during a running sync, starts nothing.

**A stale listing never starts a sync inside the [Refresh cooldown](#refresh)**, whatever the
TTL, so repeating the listing cannot start syncs more often than Refresh allows (the shared
unauthenticated 60/h budget belongs to the whole instance). Inside the cooldown it only returns
the stored rows.

Because the listing is a `POST` covered by `OriginGuard`, this side effect needs no exception to
the "no state change over `GET`" rule
([architecture/security.md](../../architecture/security.md#rules-for-future-changes)).

## Repository identity

- The internal repository `id` is **never exposed**.
- The canonical key is **`githubId`**: GitHub's global id, identical on every Kerghan instance (all
  talk to the fixed `api.github.com`) and stable across renames and transfers. A future sync
  between Kerghan instances can match on `githubId` with no registry of external ids; that sync
  is out of scope and only motivates the choice.
- Every response also carries **`fullName`** (`owner/name`).

### Repo ref

Every per-repo route (Add now, and future ones such as issues and labels) takes the repo in the
**body**, as exactly one of:

- `{ "githubId": 123456 }`: used by the UI;
- `{ "fullName": "darthjee/kerghan" }`: for consumers that only know the git remote, such as the
  CLI or an AI agent working in a repo folder.

Rules:

- Both or neither answers `400 VALIDATION_FAILED`.
- `githubId`: a positive integer, at most `Number.MAX_SAFE_INTEGER`. `0`, negative, fractional or
  larger values (e.g. `1e300`) answer `400`, never reach the database.
- `fullName`: exactly one `/`. The owner follows the GitHub handle rule, compared
  case-insensitively ([model.md](model.md#validation): letters, digits, single hyphens, no
  leading or trailing hyphen, at most 39 characters); the name matches `[A-Za-z0-9._-]{1,100}` and is neither `.` nor `..`. Anything
  else answers `400`.
- `fullName` is resolved **case-insensitively against the caller's own rows** only, so a ref can
  only reach repos already in the user's listing (#444's "Add by `owner/name` not in the listing"
  exclusion still holds). A ref not found among the caller's rows answers `404`.
- The ref lives in the body, not the path: repo names containing dots (`.github`, `x.json`) would
  clash with the `.json` suffix routing.
- A stale local remote (an old name after a rename) answers `404` until a sync records the new
  name; GitHub's rename redirects are not followed. A `githubId` ref is unaffected by a rename.
- **`fullName` tie-break:** a user can hold two rows with the same `owner/name` and different
  `github_id`s: a stale row (a repo renamed away whose only source failed, or a deleted repo kept
  as added Unavailable) and a newer repo now using that name. A `{ fullName }` ref resolves to
  the matching row with the **most recent `last_seen_at`, then the highest `id`**: the repo GitHub
  most recently returned under that name. It is deterministic and needs no new error code; the UI
  always sends `githubId`, so only API callers can hit the tie.

## Sync state

`POST /repositories/sync/state.json`, no body. Returns the sync-state object; the listing embeds
the same object as `sync`.

```json
{
  "state": "syncing",
  "startedAt": "2026-11-07T12:00:00Z",
  "lastSyncedAt": "2026-11-07T11:00:00Z",
  "refreshAvailableAt": "2026-11-07T12:05:00Z",
  "sources": [
    { "kind": "integration", "integration": { "uuid": "…", "label": "work-pat" },
      "status": "ok", "syncedAt": "2026-11-07T11:00:00Z", "resetAt": null },
    { "kind": "handle", "handle": "darthjee",
      "status": "rate_limited", "syncedAt": "2026-11-07T11:00:00Z",
      "resetAt": "2026-11-07T11:40:00Z" }
  ]
}
```

| Field | Meaning |
|---|---|
| `state` | `idle` or `syncing`. A sync whose heartbeat is older than its lease is dead and reads `idle` ([sync.md](sync.md#restart-recovery)). |
| `startedAt` | Start of the running sync (`last_started_at`); `null` when idle. |
| `lastSyncedAt` | End of the last finished sync; `null` = never synced (the UI shows its first-sync spinner). |
| `refreshAvailableAt` | End of the Refresh cooldown (`last_started_at` + cooldown); `null` = Refresh available now. The UI disables Refresh with a countdown; the server still answers `429` + `Retry-After` for races and other clients. |
| `sources[]` | One entry per **current** source; a deleted integration's entry disappears. |
| `sources[].status` | `ok`, `error`, `invalid_credentials`, `rate_limited`, `page_cap_reached`, `not_found` (handle only: the handle listing answered `404`, [sync.md](sync.md#handle-credential)), or `pending` (a source added since the last sync: a new integration, a newly set handle; or a fixed integration, below). |
| `sources[].syncedAt` | When that source last ran; `null` when `pending`. |
| `sources[].resetAt` | Only for `rate_limited`: GitHub's reset time; `null` otherwise. |

- A source entry never reveals whether the handle went through an integration or the
  unauthenticated path, and carries no integration field beyond `uuid` and `label`.
- **A fixed integration reads `pending`:** on read, a stored `invalid_credentials` status for an
  integration that is now **usable** ([usable integrations](integrations.md#usable-integrations))
  reports `pending`, with `syncedAt: null`. The listing and this route already load the user's
  integrations to resolve labels, so it costs no query. No event and no write: the next sync of
  that source replaces the stored status. This removes the stale "Fix it in Integrations" banner
  after a Test or a Replace.
- The UI shows a banner for every status other than `ok` and `pending`
  ([ui.md](ui.md#source-errors)).
- **The route never starts a sync**, so polling cannot re-trigger one. Its only possible write is
  the [handle reconciliation](model.md#handle-changes) shared by every route.

### Polling contract

- While `state` is `syncing`, the frontend polls `POST /repositories/sync/state.json` at a fixed
  **frontend constant** interval of 2 s ([sync.md](sync.md#values)).
- It stops on `idle` (then reloads the current listing page; the data is fresh, so that reload
  never starts another sync), on unmount, or on `401`. A transient error (network, `5xx`) keeps
  polling at the same interval.
- There is no scheduled job (#444); each sync is background work started by a request, run
  in-process. A sync stuck in `syncing`, e.g. after a backend restart, reads `idle` once its
  lease expires, so polling always ends ([sync.md](sync.md#restart-recovery)).

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
  ([sync.md](sync.md#values)).
- "Already syncing" and "cooldown" are one atomic claim ([sync.md](sync.md#per-user-lock)), so
  concurrent Refreshes start one sync.
- Refresh runs every source; there is no per-source refresh. A `rate_limited` source is skipped
  while its `resetAt` is in the future: no GitHub call, its status, `resetAt` and rows are kept
  ([sync.md](sync.md#rate-limits)).

## Add

`POST /repositories/add.json`, body = a [repo ref](#repo-ref). Marks a repository of the caller's
listing as added.

| Step | Check | Failure answer |
|---|---|---|
| 1 | DTO: exactly one of `githubId` / `fullName`, well formed | `400 VALIDATION_FAILED` |
| 2 | Per-user Add rate limit | `429 REPOSITORY_ADD_RATE_LIMITED` + `Retry-After` |
| 3 | Ref looked up in the **caller's own rows**, by `user_id` from the session in the query itself | `404 NOT_FOUND`, no GitHub call, no write |
| 4 | Already added | **`200`** with the current row: idempotent, no GitHub call, no write; the original `addedAt` and access link are kept |
| 5 | GitHub re-check: one request for that repository, through the chosen access integration ([integrations.md](integrations.md#access-link-on-add)) | **No candidate** before any GitHub call (every source holding the repo is a non-usable integration, and the handle source does not hold it): `409 REPOSITORY_SOURCE_UNUSABLE`, no GitHub call, nothing written. Denied (`404`/`403` from every candidate called): `404 NOT_FOUND`, nothing written. Unauthenticated low budget, or a GitHub rate limit: `503 GITHUB_RATE_LIMITED` + `Retry-After` when known (never `404`, nothing marked `invalid`). Timeout / `5xx`: `502 GITHUB_UNAVAILABLE`. |
| 6 | Write, conditional: `UPDATE … SET added_at, integration_id, snapshot WHERE id = :id AND user_id = :userId AND added_at IS NULL` | **`200`** with the updated row (listing row shape, `status: "added"`). Zero rows ⇒ re-read the row: **added** ⇒ `200` with the current row (a concurrent Add won: its `addedAt` and link are kept); **missing** ⇒ `404 NOT_FOUND` (pruned meanwhile). |

- `200`, not `201`: the row already existed; Add only marks it.
- **Owner lookup first:** a missing row, including one only another user holds, answers the same
  `404` as a GitHub denial, with no GitHub call and no write. Only repos already in the user's own
  listing can be added.
- **Rate limit before the lookup:** every attempt past validation counts, so the limit bounds both
  the GitHub budget and probing; a `404` reveals nothing, since the lookup covers only the
  caller's own rows.
- **The re-check is built only from the stored row** (its `github_id`, or its stored
  `owner`/`name` URL-encoded), never from the request's `fullName`, so no user input reaches the
  GitHub API path ([security.md](security.md#fixed-github-base-url)).
- When only the public source sees the repo, the re-check goes through a usable integration if the
  user has one (without linking it), and unauthenticated otherwise. If that re-check shows the
  repo has become **private**, the integration that granted it is linked as `integration_id`, so
  the stored private metadata stays tied to the integration that granted it
  ([model.md](model.md#private-metadata-lifecycle)) and the row reads as Added, not
  Unavailable.
- The unauthenticated re-check goes through the shared process-wide budget tracker with **Add's
  own threshold**: it is refused only when the remaining budget is **≤ 0** (the sync stops at
  ≤ 10, keeping a reserve for Add), answering `503` with no GitHub call
  ([sync.md](sync.md#rate-limits)).
- **Race with pruning:** the write is `UPDATE … WHERE id = :id AND user_id = :userId AND
  added_at IS NULL`. If a sync's pruning deleted the not-added row first, the update affects no
  row, the re-read finds nothing, and Add answers `404 NOT_FOUND` (the repo left the listing); if
  Add commits first, pruning skips the row ([model.md](model.md#private-metadata-lifecycle)).
- **Double Add:** two concurrent Adds of the same repo both pass step 4. Only one write matches
  `added_at IS NULL`; the other affects no row, re-reads the row as added and answers `200` with
  the first Add's `addedAt` and access link. The losing request's GitHub call is wasted, which the
  per-user Add rate limit bounds.
- **`409 REPOSITORY_SOURCE_UNUSABLE`:** decided after the rate limit and the lookup in the
  caller's own rows, only from the caller's own sources, so it reveals nothing about other users
  or about GitHub ([integrations.md](integrations.md#add-re-check-candidates)). Once at least one
  candidate was called and every one denied the repo, or the 3-call cap was reached, the answer
  stays `404 NOT_FOUND`.
- `502 GITHUB_UNAVAILABLE` and `503 GITHUB_RATE_LIMITED` reuse the existing codes and helpers,
  moved to `core/github-http-errors.ts` ([integrations.md](integrations.md#shared-502--503-helpers)).
- **Candidate walk** ([integrations.md](integrations.md#add-re-check-candidates)), at most **3
  GitHub calls** per Add: first the usable integrations holding a source row for the repo, oldest
  first; then, when the handle source sees it, the remaining usable integrations, oldest first,
  then unauthenticated. A `401` (which also marks a `pat` / `oauth_app` integration `invalid`),
  `403` or `404` moves to the next candidate; a rate limit, timeout, `5xx` or redirect stops the
  walk (`503` / `502`, no fallback). No candidate left, or the cap reached, after denials ⇒
  `404 NOT_FOUND`. No candidate at all before any call ⇒ `409 REPOSITORY_SOURCE_UNUSABLE`.

### Add rate limit

Per user, **30 Adds per 60 s** by default, following the abuse-guard services in
`backend/src/auth/`:

| Env var | Default | Meaning |
|---|---|---|
| `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW` | `30` | Adds allowed per user per window. |
| `KERGHAN_REPOSITORIES_ADD_WINDOW_MS` | `60000` | Window length in milliseconds. |

Both are read with `getNumberConfig` like the existing abuse guards, and are listed in
`docs/agents/environment-variables.md` when implemented.

## Errors

Standard error shape (`core/http-exception.filter.ts`,
[Error responses](../../architecture/backend.md#error-responses)).

| Status | Code | Message | Where |
|---|---|---|---|
| `400` | `VALIDATION_FAILED` | standard validation message | Listing body; Add ref (both/neither, malformed `fullName`, non-integer `githubId`) |
| `401` | `UNAUTHORIZED` | standard | Every route without a session (`JwtGuard`) |
| `403` | `FORBIDDEN` | standard | Foreign origin (`OriginGuard`) |
| `404` | `NOT_FOUND` | `Repository not found` | Add: ref not among the caller's rows, held only by another user, or denied by GitHub. **Same message for every case.** |
| `409` | `REPOSITORY_SOURCE_UNUSABLE` (new) | `The integration that sees this repository needs attention.` | Add with no candidate: every source holding the repo is a non-usable integration and the handle source does not hold it |
| `429` | `REPOSITORY_REFRESH_COOLDOWN` (new) | `Repositories were synced recently; try again later` | Refresh inside the cooldown |
| `429` | `REPOSITORY_ADD_RATE_LIMITED` (new) | `Too many repositories added; try again later` | Add over the per-user limit |
| `502` | `GITHUB_UNAVAILABLE` (existing) | `GitHub is unavailable; try again later` | Add re-check timeout / `5xx` |
| `503` | `GITHUB_RATE_LIMITED` (existing) | `GitHub rate limit reached; try again later` | Add re-check on a low budget or a GitHub rate limit |

- **Retry delay:** both `429`s, and the `503` when the reset time is known, send `Retry-After`
  (whole seconds, rounded up) **and** `error.retryAfterSeconds` in the body. Today the filter
  turns a throw site's `retryAfterSeconds` into the header only; exposing it in the body is a new,
  optional field of the standard error shape, added by the implementation and folded into
  `architecture/backend.md#error-responses` by #452.
- Sync failures never become HTTP errors: they appear only as the per-source `status` in the
  [sync state](#sync-state); the UI maps each to its banner text.
- GitHub error bodies and messages are never echoed, nor any credential detail. Anything
  unexpected falls through to the existing `500 INTERNAL_ERROR`.
- The three new codes join `ErrorCodes` (`core/error-codes.ts`); their helpers live in the
  Repositories module, like `integrations/integration-http-errors.ts`. The `502`/`503` reuse the
  existing helpers `githubUnavailable()` / `githubRateLimited()`, moved (unchanged) from
  `integrations/integration-http-errors.ts` to `core/github-http-errors.ts`, so Repositories
  never imports Integrations' HTTP layer ([integrations.md](integrations.md#shared-502--503-helpers)).

## Access

- Every query is scoped to the session's user.
- Another user's repository, or a repository the user cannot see, answers `404` like a missing
  one.
- Admins have no access to anyone's repositories (same rule as integrations).
- No response includes credential material (secrets, tokens, GitHub App installation tokens) or
  anything computed from it ([security.md](security.md#credentials-stay-in-the-backend)).
- **Exposed identifiers:** no response includes the internal repository `id`, `user_id` or an
  internal `integrations.id`. Integrations are referenced only by their `uuid` and label, and only
  the caller's own. Repo responses carry no other integration field (no `secretHint`,
  `github_login`, `status_reason` or metadata).
- The field is named `uuid`; it holds the same value the Integrations API exposes as `id`
  ([routes/integrations.md](../../backend/routes/integrations.md)).
- `sources[].integration` and `accessIntegration` are resolved through a lookup also filtered by
  the caller's `user_id`: an integration that does not match (another user's, or deleted) is
  dropped from `sources[]` and reads as `null` in `accessIntegration`.

## Required tests

Backend e2e. How GitHub is mocked and how the sync engine is tested is #451's.

**Routes:**

- Each of the four routes is `POST`, answers `401` without a session (same-origin request) and
  `403` from a foreign origin (`OriginGuard`, also without a session), and declares the
  `user-scoped` cache class; no repositories route answers `GET`.
- Unknown body properties are stripped and ignored.
- Authenticated, same-origin responses (success, and handler errors such as `400`, `404`,
  `429`) send `X-Skip-Cache` + `Cache-Control: no-store`; the headers are not asserted on the
  guard `401` / `403`.
- A user never sees, adds or refreshes another user's repositories; another user's repository
  answers `404`. An admin has no access to another user's repositories.
- No response body contains credential material, the internal repository `id`, `user_id`, an
  internal `integrations.id`, `secretHint`, `github_login`, `status_reason`, or any other
  integration field beyond `uuid` and `label`.
- A row's `sources[]` and `accessIntegration` never resolve an integration of another user.
- After the GitHub handle changed or was cleared, each of the four routes, called first, answers
  without the old handle's source rows (and without not-added repos only it returned); a new
  handle reads `pending` in `sources[]`; `sources[].handle` is the normalised handle.
- A `fullName` whose owner differs only in case from the stored one resolves; an owner with
  `--`, a leading or trailing hyphen, or over 39 characters answers `400`.

**Listing:**

- It never calls GitHub synchronously; it reads from the database.
- Defaults and bounds of `page` / `perPage` / `filter` / `search`: `perPage` > 100,
  `filter: "unknown"` and `search` > 100 characters answer `400`; a past-the-end page answers
  `200` with an empty list.
- The filter accepts no Unknown value; Unknown rows appear under `all`.
- Stable sort (`owner`, `name`, `githubId`, case-insensitive); correct `pagination` totals with
  filter and search.
- `%` and `_` in `search` match literally.
- Exact row shape; `accessIntegration` is `null` in the three documented cases.
- A row's `sources[]` includes the entry of a failed source that still holds a row for it.
- A stale listing starts a sync; a fresh one, one during a running sync, or a stale one inside
  the Refresh cooldown does not.

**Sync state:**

- Exact shape; `pending` for a new source; a deleted integration's entry is gone.
- A stored `invalid_credentials` status for an integration that is now usable reports `pending`;
  one still non-usable reports `invalid_credentials`.
- A `not_found` handle status is reported as `not_found`.
- The route never starts a sync.
- A sync stuck in `syncing` past its lease reads `idle`, with `startedAt: null`.

**Refresh:**

- `202` starts a sync; `202` while syncing starts no new sync and does not reset the cooldown.
- `429 REPOSITORY_REFRESH_COOLDOWN` + `Retry-After` + `error.retryAfterSeconds` inside the
  cooldown, including right after a stale-triggered sync.
- Two concurrent Refreshes start one sync.
- A `rate_limited` source whose `resetAt` is in the future is skipped by Refresh.

**Add:**

- Both or neither ref answers `400`; so do a `githubId` of `0`, negative, fractional or above
  `Number.MAX_SAFE_INTEGER`, and a `fullName` outside the documented format (no `/`, two `/`,
  name `.` or `..`, over-long parts).
- The GitHub re-check request is built from the stored row, never from the request's
  `fullName`.
- An unlinked re-check that finds the repo private links the granting integration; the row
  reads Added.
- `fullName` resolves case-insensitively, only among the caller's rows: absent, or held only by
  another user, answers `404` without any GitHub call.
- Already added answers `200`, with no GitHub call and `addedAt` unchanged.
- A GitHub denial answers `404` and writes nothing.
- The re-check on a low budget answers `503 GITHUB_RATE_LIMITED`, not `404`; a timeout / `5xx`
  answers `502 GITHUB_UNAVAILABLE`.
- The candidate walk: a `401` / `403` / `404` moves to the next candidate, a rate limit, timeout,
  `5xx` or redirect stops it; never more than 3 GitHub calls; denials everywhere answer `404`.
- Add on a not-added row pruned concurrently answers `404 NOT_FOUND` and writes nothing.
- The 31st Add in 60 s answers `429 REPOSITORY_ADD_RATE_LIMITED`, and the env overrides apply.
- Every `404` carries the same message.
- With two rows sharing a `fullName`, Add by `fullName` resolves to the latest-seen row, then the
  highest `id`.
- Add by `githubId` is unaffected by a rename.
- Two concurrent Adds of the same repo write once; both answer `200` with the same `addedAt` and
  access link.
- Add with only non-usable sources (and no handle row) answers `409 REPOSITORY_SOURCE_UNUSABLE`
  with no GitHub call and no write; with one usable candidate that denies it, Add answers `404`.
