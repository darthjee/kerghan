# Issues and Projects API — GitHub link

The GitHub link routes (import, attach, unlink), their failures, and how sync state is exposed. Back to the [Issues and Projects API](../api.md) hub.

## GitHub link

| Action | Route | Body | Success |
|---|---|---|---|
| Import | `POST /projects/:projectId/issues/import.json` | `{ number }` | `201` issue (linked) |
| Attach | `POST /projects/:projectId/issues/:issueId/attach.json` | `{ number, confirmUpdatedAt? }` | `200` issue (linked) |
| Unlink | `POST /projects/:projectId/issues/:issueId/unlink.json` | `{ discardUnsentChanges? }` | `200` `{ issue, droppedUnsentChanges }` |

`number` is the GitHub issue number in the project's repository, a positive integer ([github-link.md](../github-link.md#creating-a-link)). Import and attach share one service method.

### Order of checks (import and attach)

1. DTO and path validation (`400`), then the link rate limit (`429 ISSUE_LINK_RATE_LIMITED`, import and attach share one window, [security.md](../security.md#request-rate-limits)), then the single access check (`404`). Import only: the issue cap pre-check, `409 ISSUES_LIMIT_REACHED`, before any GitHub call.
2. Attach only: the Kerghan issue already has a link: `409 ISSUE_ALREADY_LINKED` (E64).
3. The project has no repository: `409 PROJECT_HAS_NO_REPOSITORY`. Its repository is Unavailable (or dangling): `409 PROJECT_REPOSITORY_UNAVAILABLE`. Neither makes a GitHub call; Unknown is allowed.
4. One `GET` of the GitHub issue with the owner's credential, outside any transaction. Failures map as below; nothing is stored, no job, no wait.
5. A pull request: `422 GITHUB_ISSUE_IS_PULL_REQUEST` (E3; the input is of the wrong kind, not a conflict).
6. Transaction, locking the project then (attach) the issue: import only, the issue cap again under the project lock (`409 ISSUES_LIMIT_REACHED`); the repository changed meanwhile, `409 PROJECT_REPOSITORY_CHANGED` (retryable, E62); the GitHub issue is already linked by this user, `409 GITHUB_ISSUE_ALREADY_LINKED` with `meta.projectId` and `meta.issueId` of the existing link (E4, E46, also when the unique index decides a race); attach only, the issue gained a link meanwhile, `409 ISSUE_ALREADY_LINKED`; attach only, the [confirmation check](#attach-confirmation-e61).
7. Write: the link with status `linked`; import also creates the issue with GitHub's values.

### GitHub failures on link creation (E57 to E60)

| GitHub outcome | Answer |
|---|---|
| Not found, `410`, a `301` that is not a rename | `404 GITHUB_ISSUE_NOT_FOUND` (`GitHub issue not found`), distinct from the Kerghan `404 NOT_FOUND` |
| Rate limited | `503 GITHUB_RATE_LIMITED` (existing) with `retryAfterSeconds` and `Retry-After` |
| No usable integration, `401`, `403` | `409 GITHUB_CREDENTIAL_UNUSABLE` with `meta.reason` in the sync vocabulary: `no_credential`, `credential_invalid` or `forbidden` (a `401` still invalidates the integration; a handle alone is `no_credential`, E20) |
| Timeout, network error, `5xx`, unclassifiable `301` | `502 GITHUB_UNAVAILABLE` (existing) |

A rename `301` is followed once inside the adapter and is not a failure (E65). GitHub error bodies are never echoed.

### Attach confirmation (E61)

- The `409` is the warning: attach is first called without `confirmUpdatedAt`. Equal values link at once (`200`). Different values answer `409 ISSUE_ATTACH_CONFIRMATION_REQUIRED` with `meta.differences` (a subset of `["title", "body", "state"]`) and `meta.updatedAt` (the issue's current `updatedAt`). The UI asks, then repeats the call with `confirmUpdatedAt` set to that value.
- Under the issue-row lock, `confirmUpdatedAt` must equal the stored `updated_at` exactly; a missing or stale value while values differ answers the same `409` with the current differences and `updatedAt`. Each call makes one GitHub read; there is no separate preview route.
- A confirmation sent while the values are equal is ignored.
- **Precision:** `issues.updated_at` is `datetime(3)` (milliseconds from the injected `Clock`), so an edit made in the same second as the warning still changes it. The other `datetime` columns are unchanged.
- `meta.differences` names fields only, never GitHub content (rendering rules are in [security.md](../security.md#github-and-user-content)).

### Unlink (E63, E64)

- No link: `409 ISSUE_NOT_LINKED`, distinct from `404`; the UI treats it as already unlinked.
- A marker exists and `discardUnsentChanges` is not `true`: `409 ISSUE_UNLINK_HAS_UNSENT_CHANGES`; nothing changes.
- Otherwise the link and its marker are deleted in lock order and the answer is `200` with the issue (`link: null`) and `droppedUnsentChanges` (`true` only if a marker was discarded).
- Works in every link state and while the repository is Unavailable; never calls GitHub or enqueues a job.

## How sync is exposed

### Link object

The `link` field of an issue (`null` when unlinked):

```json
{
  "number": 12,
  "url": "https://github.com/darthjee/kerghan/issues/12",
  "state": "sync_failed",
  "states": ["sync_failed", "pending"],
  "reason": "credential_invalid",
  "rateLimitedUntil": null,
  "lastSyncedAt": "2026-11-17T11:00:00Z",
  "stale": false
}
```

| Field | Meaning |
|---|---|
| `number`, `url` | The GitHub issue number and its URL, built from the repository's stored `owner`/`name`. |
| `state` | The primary state: the first of `states`. |
| `states` | Every state that applies, in the precedence order of [github-link.md](../github-link.md#link-states): `gone`, `sync_failed`, `repository_unavailable`, `rate_limited`, `pending`. `linked` appears (alone) only when none of the others applies. |
| `reason` | The stored `status_reason`: `deleted`/`moved` for `gone`; `retries_exhausted`, `no_credential`, `credential_invalid`, `forbidden` for `sync_failed`; otherwise `null`. |
| `rateLimitedUntil` | The reset time while the link is in a waiting set (in memory, so it disappears on restart); otherwise `null`. Never names the integration. |
| `lastSyncedAt` | Never `null` (set on link creation). |
| `stale` | `lastSyncedAt` older than `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS`; always `false` for `gone`. |

- Derived states are computed on read and never stored; a read never enqueues a job ([sync.md](../sync.md#staleness)).
- There is no "refresh queued" or "syncing" state in v1: queue membership is not exposed. After a trigger the UI re-reads the issue (show or listing); the bounded re-reads are specified in [ui.md](../ui/linking-and-sync.md#re-reading-after-a-trigger).
- Wording and placement of every state are in [ui.md](../ui/linking-and-sync.md#link-and-sync-states).

### Trigger routes

| Trigger | Route | Body | Answers |
|---|---|---|---|
| T2 issue refresh | `POST /projects/:projectId/issues/:issueId/refresh.json` | none | `202` `{ issue, alreadyFresh: false }` enqueued; `200` `{ issue, alreadyFresh: true }` skipped |
| T3 project refresh | `POST /projects/:projectId/refresh.json` | none | `202` `{ enqueued, skippedFresh }` |
| T4 retry sync | `POST /projects/:projectId/issues/:issueId/retry-sync.json` | none | `202` `{ issue }` reset and enqueued; `200` `{ issue }` no-op |

- **T2:** "already fresh" is a link with no marker whose `lastSyncedAt` is under 60 seconds old; a link with a marker is always enqueued. A `sync_failed` or rate-limited link is enqueued like any other.
- **T3:** enqueues one reconcile per non-`gone` link of the project, oldest `lastSyncedAt` first, skipping fresh marker-less links; `enqueued` and `skippedFresh` are counts. A project with no links answers `202` with zeros.
- **T4:** a `sync_failed` link is reset to `linked` (reason `null`) at once and enqueued, so the returned link reads *pending* or `linked`. A `linked` link (double click) is a no-op `200` with nothing enqueued.
- **Refusals,** before any reset or enqueue and with no GitHub call: no link, `409 ISSUE_NOT_LINKED`; a `gone` link (T2, T4), `409 ISSUE_LINK_GONE`; no repository (T3), `409 PROJECT_HAS_NO_REPOSITORY`; repository Unavailable or dangling (T2, T3, T4), `409 PROJECT_REPOSITORY_UNAVAILABLE`.
- **Retry while Unavailable is refused, not reset.** Otherwise the reset would clear the failure reason and the job would stop at the repository guard without setting a new one ([sync.md](../sync.md#retries-and-sync_failed)).
- No trigger route has a cooldown or `429`: the 60-second fresh skip and the per-integration rate-limit pause bound the GitHub calls ([sync.md](../sync.md#staleness)).
