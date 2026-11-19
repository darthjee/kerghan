# Repositories routes — Listing

The listing route. Back to the [Routes — Repositories](../repositories.md) hub.

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
| `githubId` | GitHub's repository id, the canonical key ([Repository identity](identity-and-sync.md#repository-identity)). |
| `owner`, `name`, `fullName` | From the latest snapshot; `fullName` is `owner/name`. |
| `private` | Visibility. |
| `status` | `added`, `not_added`, `unavailable` or `unknown`, derived on read ([data model](../../../modules/repositories/data-model.md#row-statuses)). |
| `addedAt` | `null` for not-added rows. |
| `lastSeenAt` | When a source last returned the repo. |
| `sources[]` | Every **current** source holding a row for the repo, as of that source's last applied page, failed and `pending` sources included ([data model](../../../modules/repositories/data-model.md#repositories_sources)): `{ kind: "integration", integration: { uuid, label } }` or `{ kind: "handle", handle }` (`handle` is the current, normalised, lowercase handle, [data model](../../../modules/auth/github-handle.md#normalisation)). The UI matches each entry by key with the sync state's `sources[].status` and mutes a source that is not `ok` ([frontend](../../../modules/repositories/frontend.md#table)). |
| `accessIntegration` | The access link set on Add, as `{ uuid, label }`. `null` for not-added rows, for added rows only the public source sees, and for a dangling link (its integration was deleted). |

- **Sort:** fixed, case-insensitive `owner`, then `name`, then `githubId`, so pages are stable.
  No sort parameter.
- **Pagination:** page-based with totals (`page`, `perPage`, `total`, `totalPages`). `total` and
  `totalPages` count the rows matching `filter` and `search`; counts are cheap at per-user scale.
- `sync` is the same object as the [Sync state](identity-and-sync.md#sync-state) route returns.

### Stale-sync trigger

The listing starts a sync when the user's last one is stale ([sync](../../../modules/repositories/sync/execution.md#trigger); TTL
1 h, [sync](../../../modules/repositories/sync/github-limits.md#values)). The server owns the staleness rule; the frontend makes one call. The listing returns
the stored rows at once, with `sync.state` already `syncing` when it started one. A fresh listing,
or one during a running sync, starts nothing.

**A stale listing never starts a sync inside the [Refresh cooldown](refresh-and-add.md#refresh)**, whatever the
TTL, so repeating the listing cannot start syncs more often than Refresh allows (the shared
unauthenticated 60/h budget belongs to the whole instance). Inside the cooldown it only returns
the stored rows.

Because the listing is a `POST` covered by `OriginGuard`, this side effect needs no exception to
the "no state change over `GET`" rule
([architecture/security.md](../../../architecture/security.md#rules-for-future-changes)).

