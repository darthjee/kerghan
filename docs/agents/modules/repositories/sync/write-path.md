# Repositories — Sync: Write Path and Pruning

Part of the [Repositories sync](../sync.md) doc, in the [Repositories module](../../repositories.md).

## Per source

For each source, the sync reads GitHub page by page, up to the **page cap**:

- **Page-number pagination.** The sync builds every page request itself (`?per_page=100&page=N`,
  on the [endpoint of the source](../../integrations/github-service.md#endpoints-and-parameters)) and reads the `Link` header **only to know whether `rel="next"`
  exists**. It never requests a URL taken from a response
  ([security](../security.md#fixed-github-base-url)).
- Pages within a source are sequential; up to the parallelism bound of sources run at once
  ([values](github-limits.md#values)).
- The handle source drops private repos before writing anything.
- At the end, the source's status is stored: `ok`, `error`, `invalid_credentials`,
  `rate_limited` (with the reset time), `page_cap_reached` or `not_found` (handle only)
  ([data model](../data-model.md#repositories_source_statuses)). A source added since the last sync reads
  as `pending` until it runs ([routes](../../../backend/routes/repositories.md#sync-state)).

### Write path

**One transaction per page.** The GitHub request is made **before** the transaction opens; the
transaction holds only the database writes. Step 1 locks the user's sync-state row, so the page
transactions of one user's parallel sources run one after another, which keeps the upserts free
of deadlocks. **Every Repositories transaction that writes several tables locks that row first** (a run's
guarded writes, the handle reconciliation, and the `integration.deleted` / `user.deleted` listeners,
[GitHub service](../../integrations/github-service.md#deletion-hook), [data model](../data-model.md#user-deletion)), so a
cleanup during a sync serializes with the run instead of deadlocking with it.

1. `UPDATE repositories_sync_states SET heartbeat_at = :now WHERE user_id = :userId AND run_id = :mine`;
   zero rows ⇒ the run lost its lease: roll back and stop (zombie guard on every write).
   **Handle source only:** the same statement adds `AND handle <=> :runHandle` (the handle the run
   started with). Zero rows while a re-read shows `run_id` still the run's ⇒ the handle changed
   since the run started ([data model](../../auth/github-handle.md#handle-changes)): roll back and stop the handle
   source only, writing nothing more for it (no status: the reconciliation already dropped its
   rows, so the new handle reads `pending`); the other sources go on. Its end-of-source
   transaction carries the same guard.
2. Upsert the page's repos with `INSERT … ON DUPLICATE KEY UPDATE owner, name, private,
   last_seen_at, updated_at` on (`user_id`, `github_id`), then
   `SELECT id, github_id … WHERE user_id = :userId AND github_id IN (:pageIds)` to map the page
   to row ids (a multi-row upsert does not return updated rows' ids). It never touches
   `added_at` or `integration_id`, is safe under concurrency, and when two sources return the same repo the last write wins (same
   data). When the upsert turns a repo **private**, its `handle` source row (if any) is deleted
   in the same transaction, so a stale handle row from a failed or skipped handle source never
   keeps private metadata alive ([pruning](#pruning)).
3. Rewrite that page's source rows (a repo moved from another page is upserted onto this one).
4. Store the page's `etag` / `has_next` ([conditional requests](github-limits.md#conditional-requests)).

The hard deadline is checked between pages.

**End of a source** (one transaction, `run_id`-guarded; every delete `AND user_id = :userId`,
since `source_key = 'handle'` is the same string for every user):

- **success:** delete its source rows and page rows past its last page; store `ok` and
  `syncedAt`;
- **failure** (`401`, timeout, `5xx`, a redirect, rate limit, deadline): store only the status
  (`invalid_credentials`, `rate_limited`, or `error` for the others; see
  [partial failures](#partial-failures));
- **page cap:** delete its source rows and page rows **past the cap**, as for a success whose
  last page is the cap; store `page_cap_reached` (it counts as `ok` for row statuses,
  [data model](../data-model.md#row-statuses)). Pruning then applies.
  - **Accepted outcome:** after the cap is lowered, added repos past the new cap read Unavailable
    although GitHub still returns them, because Kerghan stopped reading that far; the
    `page_cap_reached` banner ("some may be missing") explains it, and the added rows are kept.
  - **Why:** listings sort by `created` ascending, so new repos land past the end and deletions
    only pull repos toward earlier pages. Rows past the cap exist only after the cap was
    **lowered**; the source never fetches them again, so keeping them would let private metadata
    outlive any check.

**End of the sync** (one transaction, `run_id`-guarded): drop the source, page and status rows
(each statement `AND user_id = :userId`) of any `integration:<id>` key whose id is not among
**all** the user's integrations (loaded `WHERE user_id = :userId`, usable or not, so a non-usable
integration's rows are kept) (the **safety net** for a
failed [deletion hook](../../integrations/github-service.md#deletion-hook), or a page a parallel run wrote after the
hook's cleanup), then the [link fill](#link-fill), then [prune](#pruning), then `state = idle`,
`run_id = null`, `last_synced_at = :now`, **even when every source failed** (the sync finished;
per-source statuses carry the failures). A run that lost its lease or crashed never sets
`last_synced_at`, so the next listing starts a sync once the cooldown has passed.

- **`last_seen_at`** is "when a source page last returned the repo" (`200` or `304`), even if
  that source fails on a later page. It is informational: no status derives from it
  ([data model](../data-model.md#repositories)).
- Rejected: all-or-nothing per source (buffer every page, write once): long transactions and
  lost work on failure.
- **A run never creates the sync-state row.** Only the request entry points (the listing, the
  sync-state route, Refresh, Add) create it, with `INSERT … ON DUPLICATE KEY UPDATE`. The run's
  start-of-run [handle reconciliation](../../auth/github-handle.md#handle-changes) only locks and updates an existing
  row; with no row, the run stops. A deleted user's row ([user deletion](../data-model.md#user-deletion))
  makes every guarded write of a running sync affect no row, so the run rolls back, stops, and
  recreates nothing.

### Link fill

In the end-of-sync transaction, after the safety net and before pruning, an empty or dangling
access link of an added private repo is filled:

```sql
UPDATE repositories
SET integration_id = :integrationId
WHERE user_id = :userId AND id = :repositoryId
  AND added_at IS NOT NULL AND private = true
  AND (integration_id IS NULL OR integration_id NOT IN (:userIntegrationIds))
```

- **Skipped with no usable integration:** the fill runs only when the user has at least one
  usable integration, so `:userIntegrationIds` (all the user's integrations, loaded
  `WHERE user_id = :userId`) is never empty.
- **Which repos:** added (`added_at` set), private, with an `integration_id` that is empty or not
  among the user's integrations.
- **Which integration:** the **oldest usable** integration (`created_at`, then `id`) holding a
  source row for the repo from a source whose status is `ok` or `page_cap_reached` after this
  run. No such integration ⇒ the link stays empty and the repo reads Unavailable.
- **Never changes an existing link.** The `WHERE` clause matches only an empty or dangling link
  (a link to an existing integration, even a non-usable one, is kept), so it never overwrites a
  link Add wrote concurrently. A public repo and a not-added repo are never touched.
- **Amends #444:** #444 made a private repo whose linked integration was deleted Unavailable for
  good; the fill makes it Unavailable only until the next sync that finds a usable integration
  returning it. Changing an existing link stays out of scope.
- Every statement is `run_id`-guarded (the transaction's first statement) and `AND user_id =
  :userId`; it uses the (`user_id`, `integration_id`) index.

## Partial failures

- A failing source (`401`, timeout, `5xx`, rate limit, deadline) **does not fail the sync**; the
  other sources are still applied.
- **Pages already applied stay applied**; the rest keep their old rows: partly refreshed, never
  lost. Added repos held only by failed sources' rows read as Unknown, not Unavailable
  ([data model](../data-model.md#row-statuses)), and nothing of it is pruned.
- A `401` on an integration sets it to `invalid`, through the Integrations module
  ([GitHub service](../../integrations/github-service.md#invalid-on-401)); the handle source then moves to the next
  credential ([handle credential](../sync.md#handle-credential)).
- Hitting the page cap is reported as the source's status (`page_cap_reached`, which counts as
  `ok`); pages already read are applied and rows past the cap are deleted
  ([write path](#write-path)).

## Pruning

- **Rule:** a not-added repo (`added_at IS NULL`) is deleted when **no source row** points at it
  ([data model](../data-model.md#private-metadata-lifecycle)). Nothing else is checked: a successful source
  has already dropped the rows it no longer returns (a capped source drops those past the cap),
  and a failed or interrupted source keeps its rows, so **a failure blocks pruning by
  construction**.
- **When:** one statement in the end-of-sync transaction; and after changes that orphan
  rows outside a sync (an integration's source rows dropped by the deletion hook, the handle
  changed or cleared: the [handle reconciliation](../../auth/github-handle.md#handle-changes) prunes on the next
  Repositories request).
- Added repos are never deleted; they read Unavailable.

