# Repositories routes — Identity and sync state

Repository identity, the repo ref, the sync-state object and the polling contract. Back to the [Routes — Repositories](../repositories.md) hub.

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
  case-insensitively ([data model](../../../modules/auth/github-handle.md#validation): letters, digits, single hyphens, no
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
| `state` | `idle` or `syncing`. A sync whose heartbeat is older than its lease is dead and reads `idle` ([sync](../../../modules/repositories/sync/execution.md#restart-recovery)). |
| `startedAt` | Start of the running sync (`last_started_at`); `null` when idle. |
| `lastSyncedAt` | End of the last finished sync; `null` = never synced (the UI shows its first-sync spinner). |
| `refreshAvailableAt` | End of the Refresh cooldown (`last_started_at` + cooldown); `null` = Refresh available now. The UI disables Refresh with a countdown; the server still answers `429` + `Retry-After` for races and other clients. |
| `sources[]` | One entry per **current** source; a deleted integration's entry disappears. |
| `sources[].status` | `ok`, `error`, `invalid_credentials`, `rate_limited`, `page_cap_reached`, `not_found` (handle only: the handle listing answered `404`, [sync](../../../modules/repositories/sync.md#handle-credential)), or `pending` (a source added since the last sync: a new integration, a newly set handle; or a fixed integration, below). |
| `sources[].syncedAt` | When that source last ran; `null` when `pending`. |
| `sources[].resetAt` | Only for `rate_limited`: GitHub's reset time; `null` otherwise. |

- A source entry never reveals whether the handle went through an integration or the
  unauthenticated path, and carries no integration field beyond `uuid` and `label`.
- **A fixed integration reads `pending`:** on read, a stored `invalid_credentials` status for an
  integration that is now **usable** ([usable integrations](../../../modules/integrations/github-service/status-and-errors.md#usable-integrations))
  reports `pending`, with `syncedAt: null`. The listing and this route already load the user's
  integrations to resolve labels, so it costs no query. No event and no write: the next sync of
  that source replaces the stored status. This removes the stale "Fix it in Integrations" banner
  after a Test or a Replace.
- The UI shows a banner for every status other than `ok` and `pending`
  ([frontend](../../../modules/repositories/frontend.md#source-errors)).
- **The route never starts a sync**, so polling cannot re-trigger one. Its only possible write is
  the [handle reconciliation](../../../modules/auth/github-handle.md#handle-changes) shared by every route.

### Polling contract

- While `state` is `syncing`, the frontend polls `POST /repositories/sync/state.json` at a fixed
  **frontend constant** interval of 2 s ([sync](../../../modules/repositories/sync/github-limits.md#values)).
- It stops on `idle` (then reloads the current listing page; the data is fresh, so that reload
  never starts another sync), on unmount, or on `401`. A transient error (network, `5xx`) keeps
  polling at the same interval.
- There is no scheduled job (#444); each sync is background work started by a request, run
  in-process. A sync stuck in `syncing`, e.g. after a backend restart, reads `idle` once its
  lease expires, so polling always ends ([sync](../../../modules/repositories/sync/execution.md#restart-recovery)).

