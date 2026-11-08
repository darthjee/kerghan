# Issue: Specs: repositories — exact API contract

## Description

Part of Epic #444 (repositories listing). Spec-enhancement sub-issue, second in the order #445 → #446 → … → #451: it refines `docs/agents/specs/repos/api.md`, written by #445 (merged), and settles the API contract of the repositories feature in the style of `docs/agents/backend/routes/` (e.g. `docs/agents/backend/routes/integrations.md`).

## Problem

`api.md` names the four routes (listing, sync state, Refresh, Add) but leaves their contract open: paths, request and response shapes, pagination, filter and search parameters, the polling contract, the exposed repository identifier, error codes and messages, and the Add rate-limit values. It also writes the listing and sync state as `GET`, against the repo convention that user-scoped reads use `POST` (Tent's cache key ignores the method), and leaves open whether the stale-sync trigger may be a side effect of a `GET`. The open markers in `api.md#listing`, `api.md#contract`, `security.md#errors-and-logging` and the #446 half of `ui.md#sync-ux` cannot be implemented as they stand.

## Expected Behavior

- `docs/agents/specs/repos/api.md` documents every route with request/response examples and error codes, as decided below, and its "Required tests" lists the contract tests.
- The #446 open markers are removed from `api.md`, `security.md`, `ui.md` and the README open-markers table; the `ui.md#sync-ux` row keeps only #447's polling-interval value.
- Every decision that changes another spec file (`security.md`, `ui.md`, `sync.md`, `integrations.md`, `README.md`) is applied in the same PR.
- No code changes; no permanent docs (folded by #452).
- Reviewers for the PR: product-owner, security, data-access, and cache (cache classes / `X-Skip-Cache`).

## Solution

### Methods and paths

Repo convention (`docs/agents/backend/routes/integrations.md`): **user-scoped reads use `POST`**,
because Tent's cache key ignores the method. The only `GET` routes in the backend are
`health.json` and `ready.json`. `api.md` currently writes the listing and sync state as `GET`;
this issue changes them to `POST`.

| Action | Route | Body |
|---|---|---|
| Listing | `POST /repositories/mine.json` | `{ page, perPage, filter, search }` (shape: see below) |
| Sync state | `POST /repositories/sync/state.json` | none |
| Refresh | `POST /repositories/sync.json` | none |
| Add | `POST /repositories/add.json` | a repo ref: `{ githubId }` or `{ fullName }` (see below) |

- Every route: `JwtGuard`, `OriginGuard` (all are `POST`), cache class `user-scoped`
  (`X-Skip-Cache`, `Cache-Control: no-store`, as any non-GET), never warmed by Navi.
- **Stale-sync trigger:** the listing `POST` starts a sync when the last one is stale (TTL from
  #447). The server owns the staleness rule; the frontend makes one call. This settles the
  `api.md#listing` open marker: with no `GET`, no exception to the "no state change over `GET`"
  rule is needed, and nothing about it is folded into `architecture/security.md`.
- **Sync state is a pure read:** it never starts a sync, so polling cannot re-trigger one.
- `api.md` "Every route" and "Required tests" are updated to say `POST` for every route.

### Listing request and response

No pagination precedent exists in the repo; this is the first one.

Request body (DTO with whitelist validation; any invalid value answers `400 VALIDATION_FAILED`):

```json
{ "page": 1, "perPage": 50, "filter": "all", "search": "kerg" }
```

| Field | Rule |
|---|---|
| `page` | Integer ≥ 1, default 1. A page past the end answers `200` with an empty list. |
| `perPage` | Integer, default 50, maximum 100. |
| `filter` | `all` (default), `added`, `not_added`, `unavailable`. `unknown` is rejected (Unknown rows show only under `all`). |
| `search` | Trimmed, at most 100 characters, case-insensitive substring match on `owner/name`; empty means no search. |

Response:

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
  "sync": "the sync-state object (see Sync state)"
}
```

- `status`: `added` | `not_added` | `unavailable` | `unknown` (derived, [model.md](model.md#row-statuses)).
- `accessIntegration`: `null` for not-added rows, public-only added rows, and a dangling link.
- **Sort:** fixed, case-insensitive `owner`, then `name`, then `githubId`, so pages are stable. No
  sort parameter.
- **Pagination:** page-based with totals (`page`, `perPage`, `total`, `totalPages`); counts are
  cheap at per-user scale.

### Repository identity

- The internal `id` is **never exposed**. The stored and canonical key is **`githubId`**: GitHub's
  global id, identical on every Kerghan instance (all talk to the fixed `api.github.com`) and
  stable across renames and transfers. A future sync between Kerghan instances can match on
  `githubId` with no registry of external ids; that sync is out of scope and only motivates this
  choice.
- Every response also carries **`fullName`** (`owner/name`).
- **Repo ref.** Every per-repo route, Add now and future ones (issues, labels), takes the repo in
  the **body** as exactly one of:
  - `{ "githubId": 123456 }`: used by the UI;
  - `{ "fullName": "darthjee/kerghan" }`: for consumers that only know the git remote, such as
    the CLI or an AI agent working in a repo folder.

  Both or neither answers `400 VALIDATION_FAILED`. `fullName` is validated against GitHub's
  owner/name format and resolved **case-insensitively against the caller's own snapshot** only,
  so Add still works only for repos in the user's listing (the "Add by `owner/name` not in the
  listing" exclusion of #444 still holds). A ref not found in the caller's rows answers `404`.
- Keeping the ref in the body avoids putting owner/name in the path, where repo names containing
  dots (`.github`, `x.json`) would clash with the `.json` suffix routing.
- A stale local remote (an old name after a rename) answers `404` until a sync records the new
  name; GitHub's rename redirects are not followed. Left to #450 (edge cases).

### Sync state and polling

`POST /repositories/sync/state.json` returns the sync-state object; the listing embeds the same
object as `sync`.

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
| `state` | `idle` or `syncing`. |
| `startedAt` | Start of the running sync; `null` when idle. |
| `lastSyncedAt` | End of the last finished sync; `null` = never synced (the UI shows its first-sync spinner). |
| `refreshAvailableAt` | End of the Refresh cooldown; `null` = Refresh available now. The UI disables Refresh with a countdown; the server still answers `429` + `Retry-After` for races and other clients. |
| `sources[]` | One entry per **current** source (a deleted integration disappears). |
| `sources[].status` | `ok`, `error`, `invalid_credentials`, `rate_limited`, `page_cap_reached`, or `pending` (a source added since the last sync: new integration, newly set handle). |
| `sources[].syncedAt` | When that source last ran; `null` when `pending`. |
| `sources[].resetAt` | Only for `rate_limited`: GitHub's reset time. |

- A source entry never reveals whether the handle went through an integration or the
  unauthenticated path, and carries no other integration field (only `uuid` and `label`).
- The UI shows a banner for every status other than `ok` and `pending`.

**Polling contract:**

- While `state` is `syncing`, the frontend polls `POST /repositories/sync/state.json` at a fixed
  **frontend constant** interval; the value is settled by #447.
- It stops on `idle` (then reloads the current listing page; the data is fresh, so that reload
  never starts another sync), on unmount, or on `401`. A transient error (network, `5xx`) keeps
  polling at the same interval.
- The sync-state route never starts a sync. There is no scheduled job (#444); each sync is
  background work started by a request. A sync stuck in `syncing` after a backend restart is
  #447's (execution and restart behaviour), which must guarantee `syncing` eventually returns to
  `idle`, or polling never ends. The contract above holds whether #447 picks in-process or a queue.

### Refresh contract

`POST /repositories/sync.json`, no body.

| Case | Answer |
|---|---|
| Idle, outside the cooldown | Starts a sync; **`202 Accepted`** with the sync-state object (`state: "syncing"`). |
| A sync already running (any trigger) | **`202`** with the current sync state; no second sync, the cooldown is not reset. Idempotent, so repeated clicks are harmless. |
| Idle, inside the cooldown | **`429`** `REPOSITORY_REFRESH_COOLDOWN`, `Retry-After: <seconds>` (rounded up), standard error shape. |
| No sources (no integrations, no handle) | `202`; the sync completes at once with an empty `sources` list; the UI shows its empty state. |

- Order of checks: `JwtGuard` and `OriginGuard`, then "already syncing", then "cooldown", then
  start.
- **The cooldown runs from the start of the last sync, whatever triggered it** (stale listing or
  Refresh). It protects the GitHub budget, notably the shared unauthenticated 60/h.
  `refreshAvailableAt` follows the same rule; the duration is settled by #447.
- Refresh always runs every source; no per-source refresh. Whether a `rate_limited` source is
  skipped until its `resetAt` is #447's.

### Add contract

`POST /repositories/add.json`, body = a repo ref (`{ githubId }` or `{ fullName }`).

| Step | Check | Failure answer |
|---|---|---|
| 1 | DTO: exactly one of `githubId` / `fullName`, well formed | `400 VALIDATION_FAILED` |
| 2 | Per-user Add rate limit | `429 REPOSITORY_ADD_RATE_LIMITED` + `Retry-After` |
| 3 | Ref looked up in the **caller's own rows** (`user_id` from the session) | `404 NOT_FOUND`, no GitHub call, no write |
| 4 | Already added | **`200`** with the current row: idempotent, no GitHub call, no write; the original `added_at` and access link are kept |
| 5 | GitHub re-check: one request through the chosen access integration ([integrations.md](integrations.md#access-link-on-add)) | Denied (`404`/`403` from every candidate): `404 NOT_FOUND`, nothing written. Unauthenticated low budget, or a GitHub rate limit: `503 GITHUB_RATE_LIMITED` + `Retry-After` when known (never `404`, nothing marked `invalid`). Timeout / `5xx`: `502 GITHUB_UNAVAILABLE`. |
| 6 | Write: snapshot refreshed, `added_at` and `integration_id` set | **`200`** with the updated row (listing row shape, `status: "added"`) |

- `200`, not `201`: the row already existed; Add only marks it.
- `502 GITHUB_UNAVAILABLE` and `503 GITHUB_RATE_LIMITED` reuse the existing codes and helpers
  (`integrations/integration-http-errors.ts`).
- **Rate limit before the lookup:** every attempt past validation counts, so it bounds both the
  GitHub budget and probing; a `404` reveals nothing, since the lookup covers only the caller's
  own rows.
- **Rate-limit values:** per user, **30 Adds per 60 s** by default, configurable with
  `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW` (30) and `KERGHAN_REPOSITORIES_ADD_WINDOW_MS`
  (60000), read with `getNumberConfig` like the existing abuse guards. Both env vars are listed
  wherever backend env vars are documented when implemented.
- A `401` on the candidate integration marks it `invalid`; whether Add then tries the next
  candidate is #448's. With no candidate left, Add answers `404`.

### Error codes and messages

Standard error shape (`core/http-exception.filter.ts`). Settles the
`security.md#errors-and-logging` open marker.

| Status | Code | Message | Where |
|---|---|---|---|
| `400` | `VALIDATION_FAILED` | standard validation message | listing body; Add ref (both/neither, malformed `fullName`, non-integer `githubId`) |
| `401` | `UNAUTHORIZED` | standard | every route without a session (`JwtGuard`) |
| `403` | `FORBIDDEN` | standard | foreign origin (`OriginGuard`) |
| `404` | `NOT_FOUND` | `Repository not found` | Add: ref not among the caller's rows, held only by another user, or denied by GitHub. **Same message for every case.** |
| `429` | `REPOSITORY_REFRESH_COOLDOWN` (new) | `Repositories were synced recently; try again later` | Refresh inside the cooldown; `Retry-After` header + `retryAfterSeconds` in the body |
| `429` | `REPOSITORY_ADD_RATE_LIMITED` (new) | `Too many repositories added; try again later` | Add over the per-user limit; `Retry-After` + `retryAfterSeconds` |
| `502` | `GITHUB_UNAVAILABLE` (existing) | `GitHub is unavailable; try again later` | Add re-check timeout / `5xx` |
| `503` | `GITHUB_RATE_LIMITED` (existing) | `GitHub rate limit reached; try again later` | Add re-check on a low budget or a GitHub rate limit; `retryAfterSeconds` when known |

- Sync failures never become HTTP errors: they appear only as the per-source `status` enum in
  the sync state (the "fixed set of statuses"); the UI maps each to banner text.
- GitHub error bodies and messages are never echoed, nor any credential detail. Anything
  unexpected falls through to the existing `500 INTERNAL_ERROR`.
- The two new codes join `ErrorCodes`; their helpers live in the Repositories module, like
  `integrations/integration-http-errors.ts`. The `502`/`503` reuse the integrations helpers;
  where they live once shared (exported vs moved to `core/`) is a note for #448.

### UI messages

Settles the #446 half of the `ui.md#sync-ux` marker (the polling interval value stays with #447).

**Refresh cooldown:**

- Inside the cooldown the **Refresh** button is disabled, with the tooltip (and accessible label)
  **"Refresh available in 2m 34s"**, counting down from `refreshAvailableAt`; it re-enables at
  zero.
- While syncing, the button is disabled and reads "Syncing…".
- On a `429` anyway (race, clock skew): the inline notice **"Repositories were synced recently.
  Try again in N s."** from `retryAfterSeconds`, and the countdown adopts it.

**Source banners** (one per source whose status is not `ok`/`pending`; `<source>` is
*integration "work-pat"* or *GitHub handle "darthjee"*):

| Status | Banner |
|---|---|
| `invalid_credentials` | `<source>` failed: invalid credentials. **Fix it in Integrations** (link to `#/account/integrations`) |
| `rate_limited` | `<source>` hit GitHub's rate limit; it will retry after `<resetAt, local time>`. |
| `page_cap_reached` | `<source>` has more repositories than Kerghan reads; some may be missing. |
| `error` | `<source>` could not be read from GitHub; its repositories may be out of date. |

The handle source never links to Integrations.

**Add errors**, shown inline on the row:

| Answer | Message |
|---|---|
| `404` | "Repository not found on GitHub." |
| `502` / `503` | "GitHub is unavailable or rate limited — try again later." |
| `429` | "Too many repositories added — try again in N s." |

### Scope and files

No code changes; only the specs folder (as #445).

| File | Change |
|---|---|
| `docs/agents/specs/repos/api.md` | The bulk: `POST` routes and paths, listing / sync-state / Refresh / Add contracts, repo ref, error table, Add rate-limit values, "Required tests". Removes both #446 open markers. |
| `docs/agents/specs/repos/security.md` | Settles `#errors-and-logging` (links the error table); Add verification mentions the `fullName` ref (own rows only) and the order rate limit → lookup → re-check. |
| `docs/agents/specs/repos/ui.md` | Sync UX: countdown and `429` notice (marker narrowed to #447's interval); banner texts per status; inline Add errors; polling stop rules. |
| `docs/agents/specs/repos/sync.md` | Trigger is the listing `POST`; the cooldown runs from any sync start; #447's execution marker gains "a stuck `syncing` must return to `idle`". |
| `docs/agents/specs/repos/integrations.md` | #448's marker gains: whether Add tries the next candidate after a `401`, and where the shared `502`/`503` helpers live. |
| `docs/agents/specs/repos/README.md` | Removes the #446 open-marker rows (the `ui.md#sync-ux` row becomes #447 only), updates the decisions summary (POST listing, repo ref), and drops any "GET exception" item from what #452 folds. |

Out of scope: the permanent docs (`backend/routes/repositories.md`, `architecture/caching.md`,
`architecture/security.md`; folded by #452), the admin-endpoint handle shape (#449), edge cases
such as stale renames (#450).

**Backward compatibility:** nothing existing changes. Every route is new; the only shared file the
implementation touches is `ErrorCodes` (two new constants). The `CLAUDE.md` GitHub-credentials
boundary stays true.

### Contract tests

Added to `api.md`'s "Required tests" (backend e2e) and `ui.md`'s (frontend). How GitHub is mocked
and how the sync engine is tested is #451's.

- **Routes:** each of the four routes is `POST`, answers `401` without a session and `403` from a
  foreign origin, and sends `X-Skip-Cache` + `Cache-Control: no-store`; no repositories route
  answers `GET`.
- **Listing:** defaults and bounds of `page` / `perPage` / `filter` / `search` (`perPage` > 100,
  `filter: "unknown"`, `search` > 100 chars → `400`; past-the-end page → `200` empty); stable
  sort; correct `pagination` totals with filter and search; exact row shape (no `id`, `user_id`,
  internal integration id or `secretHint`; `accessIntegration` `null` in the three documented
  cases); a stale listing starts a sync, a fresh one or one during a sync does not.
- **Sync state:** exact shape; `pending` for a new source; a deleted integration's entry is gone;
  the route never starts a sync.
- **Refresh:** `202` starts a sync; `202` while syncing with no new sync and no cooldown reset;
  `429 REPOSITORY_REFRESH_COOLDOWN` + `Retry-After` + `retryAfterSeconds` inside the cooldown,
  including right after a stale-triggered sync.
- **Add:** both/neither ref → `400`; `fullName` resolves case-insensitively, only among the
  caller's rows (another user's → `404`, no GitHub call); already added → `200`, no GitHub call,
  `added_at` unchanged; GitHub denial → `404`, nothing written; low budget → `503
  GITHUB_RATE_LIMITED`; timeout / `5xx` → `502`; the 31st Add in 60 s → `429
  REPOSITORY_ADD_RATE_LIMITED`, and the env overrides apply; every `404` carries the same message.
- **Frontend:** the countdown follows `refreshAvailableAt` and the `429` notice shows; polling stops
  on `idle` / unmount / `401` and then reloads the page; each banner text maps to its status, and
  the handle banner has no Integrations link; inline Add errors.
