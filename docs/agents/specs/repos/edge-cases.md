# Repositories — Edge cases

Part of the [Repositories specs](README.md).

The matrix is an **index**, not a second source of truth: each row states the outcome in one line
and links to the rule that defines it. A rule always lives in its owning file; a change of
outcome is made there first, then reflected here. `—` means the column does not apply, and
"unchanged" means the case does not change it.

## Sync sources

Renames and transfers, several sources, failure vs disappearance, page cap, rate limit, `304`.

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Repo renamed, or transferred to an owner a source still sees | Same `github_id` upserted: `owner` / `name` / `private` refreshed; `added_at` and `integration_id` untouched. The page's ETag changes, so GitHub answers `200`. | Unchanged | `ok` | New `owner/name` after the reload | [model.md](model.md#repositories), [sync.md](sync.md#write-path) |
| Transferred to an owner no source sees | Every source succeeds without it, so its source rows are deleted. | Not added: pruned. Added: Unavailable. | `ok` | — | [model.md](model.md#private-metadata-lifecycle) |
| Transferred away from the handle's owner | Drops out of the handle listing (`type=owner`); its `handle` row is deleted. | As above, unless another source still returns it | `ok` | The handle badge goes | [sync.md](sync.md#sources) |
| Transferred back later | Same `github_id` returned again. | An added Unavailable row returns to Added (`added_at` kept); a pruned row is re-inserted as Not added. | `ok` | — | [model.md](model.md#repositories) |
| Renamed while its only source is failing | Old `owner` / `name` kept until a successful sync. | Unknown (if added) | failure | Muted badge | [sync.md](sync.md#partial-failures) |
| Add `{ fullName }` with the old name before a sync | No row matches. | — | — | — | [api.md](api.md#repo-ref) |
| Add `{ fullName }` matching two rows (a stale row and a newer repo using the name) | — | Resolves to the latest `last_seen_at`, then the highest `id` | — | The UI always sends `githubId` | [api.md](api.md#repo-ref) |
| Add `{ githubId }` after a rename | The re-check uses `GET /repositories/{id}`, unaffected by the name. | Normal Add | — | — | [integrations.md](integrations.md#endpoints-and-parameters) |
| Returned by one `ok` source; another source with a row for it failed | Both source rows kept. | Added | one `ok`, one failure | The failed source's badge is muted | [model.md](model.md#row-statuses) |
| Every source holding a row for it failed or is `pending` | Rows kept, nothing pruned. | Unknown | failures / `pending` | Muted badges | [model.md](model.md#row-statuses), [sync.md](sync.md#partial-failures) |
| A source's first run interrupted after it applied pages | Its rows kept, no status row. | Not ok for that source: Unknown if it alone holds an added repo | `pending` | "<source> has not been synced yet" | [model.md](model.md#row-statuses) |
| Every source succeeded without returning it | Its source rows deleted. | Added: Unavailable. Not added: pruned. | `ok` | — | [model.md](model.md#private-metadata-lifecycle) |
| Private, added; its linked integration fails while another integration still sees it | Link kept. | Added (the link is not dangling) | one failure, one `ok` | Muted badge for the failed one | [model.md](model.md#row-statuses) |
| Private, added; its linked integration is `ok` but no longer returns it, while another does | Link kept (changing a valid link is out of scope). | Added | `ok` | — | [integrations.md](integrations.md#access-link-on-add) |
| Two sources return different metadata | Last write wins; a `304` never touches `owner` / `name` / `private`. | Unchanged | — | — | [sync.md](sync.md#write-path), [sync.md](sync.md#conditional-requests) |
| A row's `sources[]` while one of its sources failed | The failed source's rows come from an earlier sync. | — | — | `sources[]` lists every current source holding a row, failed and `pending` ones included | [api.md](api.md#listing) |
| Source has more pages than the cap | Pages up to the cap applied; source and page rows past the cap deleted, then pruned. | `page_cap_reached` counts as `ok` | `page_cap_reached` | "Some may be missing" banner | [sync.md](sync.md#write-path), [model.md](model.md#row-statuses) |
| Cap lowered by config | The next sync of a large source trims rows past the new cap. | Not added: pruned. Added: Unavailable unless another source returns it. | `page_cap_reached` | As above | [sync.md](sync.md#write-path) |
| Rate limit mid-source (authenticated `403` / `429`, or the unauthenticated threshold) | Pages already applied kept; the rest keep their old rows. Skipped with no call until `resetAt`. The handle source does not fall back. | Added repos held only there: Unknown | `rate_limited` with `resetAt` | Rate-limit banner | [sync.md](sync.md#rate-limits), [sync.md](sync.md#partial-failures) |
| `304` on a page before the last | Rows kept, `last_seen_at` set, metadata untouched; the stored `has_next` (`true`) continues. | Unchanged | `ok` | — | [sync.md](sync.md#conditional-requests) |
| New repo created after a full last page | The last stored page is requested without `If-None-Match`; its `Link` shows `rel="next"`; the new page is fetched. | New row: Not added | `ok` | New row after the reload | [sync.md](sync.md#conditional-requests) |

## Integrations

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Deleted between syncs | The hook drops its source, page and status rows, clears `integration_id` and prunes. | Added private repos it linked: Unavailable until a sync fills the link. Added public repos stay Added. | Entry gone | Its badges and banner go at the next reload | [integrations.md](integrations.md#deletion-hook), [model.md](model.md#row-statuses) |
| Deleted during a sync | Its source answers `integration_unusable` (`missing`) and stops with no status. A page written after the hook's cleanup is dropped by the end-of-sync safety net, before pruning. | As above | No status written; entry gone | As above | [sync.md](sync.md#sources), [sync.md](sync.md#write-path) |
| Turned `invalid` mid-sync (a `401` on the handle source through it, or on its own source) | Its rows kept. The handle source moves to the next usable integration. | Added repos it alone holds: Unknown | `invalid_credentials` | "Fix it in Integrations" banner | [sync.md](sync.md#handle-credential), [integrations.md](integrations.md#invalid-on-401) |
| Non-usable between syncs (`expired`, `invalid`, `undecryptable`) | Not called; rows kept until the integration is fixed or deleted. | Added repos it alone holds: Unknown | `invalid_credentials` | "Fix it in Integrations" banner | [integrations.md](integrations.md#usable-integrations) |
| Type disabled on this server | Not called; rows kept. | As above | `error` | Error banner | [integrations.md](integrations.md#usable-integrations) |
| Fixed by Test or Replace before the next sync | Stored `invalid_credentials` kept until the next sync. | Unchanged until the next sync | Reads `pending` | Banner gone | [api.md](api.md#sync-state) |
| Credential replaced, same `github_login` | The cached token is evicted; old ETags miss, so the next sync gets `200`. | Unchanged in effect | `ok` after the next sync | — | [sync.md](sync.md#conditional-requests) |
| Credential replaced, different `github_login` | The old login's rows stay until that source's next sync, which rewrites each page and deletes rows past its last page. | Not-added repos only the old login saw: pruned. Added ones: Unavailable unless another source returns them. | `ok` after the next sync | — | [sync.md](sync.md#write-path) |
| Deleted and re-created with the same credential | New `integration:<id>` source; its sync fills the empty links of the added private repos it returns. | Added private repos: Unavailable, then Added after the sync | `pending`, then `ok` | — | [sync.md](sync.md#link-fill) |

## Handle

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Handle unknown, renamed, suspended or deleted on GitHub (`404`) | Rows and pages kept; nothing pruned; no fallback to another credential; retried on every sync. | Added repos it alone holds: Unknown | `not_found` | "GitHub handle … was not found on GitHub. Check it on your Account page." | [sync.md](sync.md#handle-credential), [ui.md](ui.md#source-errors) |
| Handle names an organization | `/users/{org}/repos?type=owner` lists the org's public repos; accepted. | Normal | `ok` | — | [integrations.md](integrations.md#endpoints-and-parameters) |
| Handle with no public repos | No rows. | Not added: pruned. Added: Unavailable unless another source returns them. | `ok` | "No repositories found" if no other source has any | [model.md](model.md#private-metadata-lifecycle), [ui.md](ui.md#empty-state) |
| Handle equals the login of one of the user's integrations | The same repos come through both sources, merged by `github_id`. | Normal | `ok` | Two source badges | [sync.md](sync.md#sources) |
| Handle changed or cleared | The reconciliation on the next Repositories request drops the handle's rows and prunes. | Not added only it returned: pruned. Added: Unavailable unless another source returns them. | A new handle reads `pending` | — | [model.md](model.md#handle-changes) |
| Handle changed during a sync | The run's handle-source writes are refused by the `handle <=> :runHandle` guard. The other sources finish. | As above | No status written; the new handle reads `pending` | — | [sync.md](sync.md#write-path) |
| Handle source and `invalid_credentials` | Cannot happen: after a `401` the handle falls back, ending with the unauthenticated call. | — | — | Only integration sources show that banner | [sync.md](sync.md#handle-credential), [ui.md](ui.md#source-errors) |

## Visibility

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Public → private, not added, an integration sees it | The integration's upsert sets `private` and deletes the `handle` row in the same transaction. | Not added, held by the integration | `ok` | The handle badge goes | [sync.md](sync.md#write-path) |
| Public → private, not added, only the handle saw it | The handle source (public only) succeeds without it, so its row goes. | Pruned | `ok` | — | [sync.md](sync.md#sources) |
| Public → private, added, link set | Link kept. | Added while the linked integration sees it | `ok` | — | [model.md](model.md#row-statuses) |
| Public → private, added, no link (added via the handle) | Filled at the end of the same sync with the oldest usable integration that holds a row for it from an `ok` or `page_cap_reached` source. | Added; if no integration sees it, Unavailable | `ok` | — | [sync.md](sync.md#link-fill) |
| Private → public, not added | The integration still holds it and the handle now returns it. | Not added | `ok` | Two badges | [sync.md](sync.md#sources) |
| Private → public, added (link set, empty or dangling) | A set link is kept, never cleared. | Added: a public repo needs no link | `ok` | — | [model.md](model.md#row-statuses) |
| Turned private while the only source holding it (the handle) fails | Stays `private = false` (stale); only pre-flip public metadata is kept. The handle's next success drops it. | Unknown if added | failure | Muted badge | [sync.md](sync.md#partial-failures) |
| Add of a repo whose visibility flipped since the last sync | The re-check refreshes `private`; a repo now private is linked to the integration that granted it. | Added | — | — | [api.md](api.md#add) |

## Concurrency

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Two tabs open a stale listing | One sync (atomic claim). | — | — | Both get stored rows and the same sync state | [sync.md](sync.md#per-user-lock) |
| Refresh during a sync | Cooldown not reset. | — | — | `202` with the running sync | [api.md](api.md#refresh) |
| Refresh in another tab inside the cooldown | Nothing written. | — | — | `429` + `Retry-After` notice | [api.md](api.md#refresh) |
| Double Add of the same repo | One conditional write (`added_at IS NULL`) wins. | Added | — | Both answer `200` with the first Add's `addedAt` and link | [api.md](api.md#add) |
| Add during a sync's upsert | Independent columns (the upsert never touches `added_at` / `integration_id`); metadata last-write-wins, both from GitHub. | Added | — | — | [sync.md](sync.md#write-path) |
| Add vs the end-of-sync link fill | The fill matches only an empty or dangling `integration_id`, so it never overwrites Add's link. | Added | — | — | [sync.md](sync.md#link-fill) |
| Add vs pruning | Add first ⇒ kept; pruning first ⇒ Add's write and re-read find nothing. | Added, or gone | — | `404` inline error | [model.md](model.md#private-metadata-lifecycle), [api.md](api.md#add) |
| Integration deleted during Add (after its re-check) | The link is written dangling, read as empty, and refilled by the next sync. | Private: Unavailable until then | — | — | [model.md](model.md#logical-foreign-keys), [sync.md](sync.md#link-fill) |
| Credential replaced during a sync | The in-flight old-credential `401` is a no-op on the integration status (compare-and-set on `secret_iv`). | Unchanged | `invalid_credentials` for this run; reads `pending` until the next sync | No stale banner | [integrations.md](integrations.md#status-compare-and-set), [api.md](api.md#sync-state) |
| Handle changed during a sync | The handle guard stops the handle source without a status. | — | The new handle reads `pending` | — | [sync.md](sync.md#write-path) |
| Two backend instances | The claim lives in the database; the budget tracker is per instance and corrected by GitHub's headers. | — | — | — | [sync.md](sync.md#rate-limits) |

## Add

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Repo deleted on GitHub since the last sync | Every candidate answers `404`; nothing written. The row stays Not added until the next sync prunes it. | Not added | — | `404` inline error | [api.md](api.md#add) |
| Integration lost access (removed from an org, app uninstalled from the repo) | `404` / `403` ⇒ next candidate. | Added if another candidate grants it | — | Otherwise the `404` inline error | [integrations.md](integrations.md#add-re-check-candidates) |
| Token revoked | `401` ⇒ a `pat` / `oauth_app` integration set `invalid` (compare-and-set), next candidate. | As above | `invalid_credentials` at the next sync | As above | [integrations.md](integrations.md#status-compare-and-set) |
| Turned private; only the handle saw it; another usable integration has access | The remaining usable integrations are tried, oldest first; the granting one is linked. | Added | — | — | [api.md](api.md#add) |
| Turned private; nobody has access | Every candidate denies it, including the unauthenticated call; nothing written. | Not added | — | `404` inline error | [api.md](api.md#add) |
| Only non-usable integrations hold it; the handle does not | No candidate, no GitHub call, nothing written. | Not added | — | `409 REPOSITORY_SOURCE_UNUSABLE` inline error, linking to Integrations | [api.md](api.md#add), [integrations.md](integrations.md#add-re-check-candidates), [ui.md](ui.md#table) |
| Rate limit, `5xx`, timeout, redirect | The walk stops; nothing written. | Not added | — | `503` / `502` inline error | [api.md](api.md#add) |
| Add on a row pruned meanwhile | Nothing written. | Gone | — | `404` inline error; the row disappears on the next reload | [api.md](api.md#add), [ui.md](ui.md#edge-cases) |

## User deletion

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| User deleted while idle | The `user.deleted` listener deletes the user's rows in all five tables. | — | — | — | [model.md](model.md#user-deletion) |
| User deleted during a sync | The listener deletes the sync-state row; the run's next guarded write affects no row, so it rolls back and stops; the catch-all release affects no row. Nothing is recreated. | — | — | — | [model.md](model.md#user-deletion), [sync.md](sync.md#write-path), [sync.md](sync.md#restart-recovery) |
| Listener fails | Logged; the deletion stands; the orphan rows are visible to no one (retention, not exposure). | — | — | — | [model.md](model.md#user-deletion) |

## UI

| Case | Stored state | Row status | Source status | UI | Rule |
|---|---|---|---|---|---|
| Page emptied by the reload after a sync | — | — | — | Jump to the last page (from `total`) and reload once | [ui.md](ui.md#edge-cases) |
| Row changes status during a sync | — | Changes only in the database | — | Rows stay as loaded until the reload on idle | [ui.md](ui.md#edge-cases) |
| Add in flight, or its result, when the reload lands | — | — | — | Add state kept by `githubId` across the reload | [ui.md](ui.md#edge-cases) |
| Added under the "Not added" filter | — | Added | — | The row stays visible until the next reload or filter change | [ui.md](ui.md#edge-cases) |
| A source that is not `ok`, or `pending` | — | — | not ok / `pending` | Muted badge, "could not be refreshed" / "has not been synced yet" | [ui.md](ui.md#table) |
| Dismissed banners | — | — | — | Hidden per (source, status, `syncedAt`), in memory; back on a new failure or a page reload | [ui.md](ui.md#edge-cases) |
| Integration deleted while the page is open | — | — | Entry gone | Its badges and banner go at the next reload | [ui.md](ui.md#edge-cases) |
| Sources exist but the sync found no repos | No rows | — | — | "No repositories found. Check the sources above." | [ui.md](ui.md#empty-state) |
| Filter or search with no matches | — | — | — | "No repositories match your filters." | [ui.md](ui.md#empty-state) |

## Required tests

Only scenario tests that span modules or steps live here. A case settled by a single rule is
tested from that rule's file.

- **Integration deleted mid-sync:** no status is written for it, no row of it remains after the
  run, the links to it are cleared, and not-added repos only it held are pruned.
- **Integration deleted and re-created with the same credential:** added private repos read
  Unavailable, then Added after the next sync, linked to the new integration.
- **User deleted during a sync:** no Repositories row of that user remains after the run ends,
  and the sync-state row is not recreated.
- **An added public repo with no link turns private:**
  - returned by an integration: after the sync it reads Added, linked to the oldest usable
    integration that returns it;
  - returned by no integration: it reads Unavailable.
- **Credential replaced during a sync:** the integration stays `active` and reads `pending`, then
  `ok` after the next sync.
- **Handle changed during a sync:** the handle source writes no status and no row of the old
  handle, the new handle reads `pending`, and the other sources finish.
- **Add during a sync:** the upsert keeps Add's `added_at` and link, and the end-of-sync link fill
  never overwrites it.
