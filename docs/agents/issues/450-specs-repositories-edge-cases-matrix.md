# Issue: Specs: repositories — edge cases matrix

## Description

Part of Epic #444 (repositories listing). A spec-enhancement sub-issue: it adds an **edge-case
matrix** to `docs/agents/specs/repos/`. For each case the matrix states the stored state, the row
status, the source status and the UI, and links to the rule behind it. It also settles every
edge-case decision left open by #445–#449. #445–#449 are merged; #451 (testing strategy) and #452
(the fold into the permanent docs) come after.

Cases covered:

- renames and transfers;
- repos seen through several sources;
- a source failing vs a repo disappearing from a source that succeeded;
- the integration lifecycle: deleted or turned `invalid` before or during a sync, credential
  replaced, access link deleted;
- the handle: changed, cleared or vanished;
- user deletion;
- visibility flips;
- page cap, a rate limit mid-sync, `304`;
- concurrency;
- Add after access was lost;
- UI edge cases.

No code changes.

## Problem

**Open markers and notes left to #450 in `docs/agents/specs/repos/`:**

- Open markers:
  - `model.md#logical-foreign-keys`: the user-deletion cleanup path;
  - `sync.md#edge-cases`: the sync edge-case matrix;
  - `ui.md#edge-cases`: the UI edge cases.
- Notes:
  - `api.md#repo-ref`: rename handling and the `fullName` tie-break;
  - `integrations.md` and `sync.md#handle-credential`: a `404` on the handle listing is `error`
    "for now";
  - `integrations.md#usable-integrations`: the rows of non-usable integrations are kept;
  - `integrations.md#deletion-hook`: user deletion;
  - `model.md`: whether `page_cap_reached` counts as `ok` for row statuses, the "handle
    vanished" status, and the rest of the Add-vs-pruning matrix.

**Gaps found while building the matrix, each with a wrong or undefined outcome under today's
rules:**

- **`304` misses new repos.** A full last page (100 repos, `has_next = false`) answers `304`
  when a new repo lands on the next page, so that repo is never fetched.
- **Double Add.** Two concurrent Adds both pass "already added?". The second overwrites
  `added_at` and the access link.
- **Replace during a sync.** An in-flight request made with the old credential gets a `401` and
  marks the freshly replaced integration `invalid`.
- **Deleted and re-created integration.** An added private repo keeps an empty link and reads
  Unavailable forever, even though the new integration sees it.
- **Rows with no status.** A source whose first run was interrupted has rows but reads
  `pending`, which row statuses do not define.
- **`sources[]` wording.** A listing row's `sources[]` is described as "returned in their latest
  sync", but a failed source's rows come from an earlier sync.
- **Lowered page cap.** Rows past the cap are kept forever, so private metadata outlives any
  check.
- **Integration deleted mid-sync.** The run writes a status for a key that no longer exists.
- **Stale banner.** A fixed integration keeps its stale "Fix it in Integrations" banner until
  the next sync.
- **Misleading Add `404`.** Add of a repo held only by non-usable integrations answers "not
  found on GitHub" without any check.
- **User deleted mid-sync.** A sync run could recreate the deleted user's sync-state row.

## Expected Behavior

- `docs/agents/specs/repos/edge-cases.md` holds the matrix: one table per area, each case with
  its outcome and a link to its rule. It is linked from the README's index.
- Every rule decided below lives in its owning spec file, with a matching "Required tests"
  entry. Cross-module scenario tests sit in `edge-cases.md#required-tests`. Each subsection of
  the Solution lists its tests.
- No code changes.

### Verification

#450 is docs-only. Its PR is verified by the following checks:

- **Markers:** no `Open — settled by #450` marker, and no "#450 may" / "stays #450's" / "#450's
  edge-case matrix" note, remains in `docs/agents/specs/repos/`.
- **Links:** every Rule cell in `edge-cases.md` points to an existing anchor, and every link
  added to the README and the other spec files resolves.
- **Coverage:**
  - every new rule or rule change has a "Required tests" entry in its owning file;
  - every scenario test sits in `edge-cases.md#required-tests`.
- **Consistency:**
  - the new status `not_found`, the reason `missing` and the code `REPOSITORY_SOURCE_UNUSABLE`
    appear in every file listed for them;
  - the replaced sentences are gone:
    - "nothing past the cap is deleted";
    - "the sources that returned it in their latest sync";
    - "`error` for now".
- **README:**
  - the three #450 open-marker rows are removed;
  - #450's decisions are in "Decisions summary";
  - `edge-cases.md` has an index row;
  - the out-of-scope line on re-linking is reworded (filling an empty link is not a change);
  - #452 checklist entries cover:
    - the `user.deleted` contract (`modules/auth.md`, the Repositories module doc);
    - `REPOSITORY_SOURCE_UNUSABLE` (`backend/routes/repositories.md`);
    - the `not_found` source status;
    - the `integrations` status compare-and-set on `secret_iv` (`modules/integrations.md`).
- **Reviews:** read-only reviews by the security, data-access and product-owner agents.
- **Out of scope:** the testing strategy itself (GitHub mocking, sync-engine harness, frontend
  specs) stays #451's.

## Solution

### Rule changes at a glance

Each one is detailed in the subsections below and must also appear in the README's "Decisions
summary".

| # | Rule | New or changed | Owning files |
|---|---|---|---|
| 1 | `fullName` tie-break: latest `last_seen_at`, then highest `id` | new | `api.md` |
| 2 | `pending` counts as not-ok for row statuses | changed | `model.md` |
| 3 | A row's `sources[]` lists every current source holding a row; the UI mutes not-ok badges | changed | `api.md`, `ui.md` |
| 4 | `integration_unusable` reason `missing`; the source stops without a status | new | `integrations.md`, `sync.md` |
| 5 | A stored `invalid_credentials` for an integration now usable reads `pending` | new | `api.md` |
| 6 | End-of-sync fill of an empty or dangling access link on added private repos (oldest usable integration whose source is `ok` or `page_cap_reached`) | new | `sync.md`, `integrations.md`, `model.md`, README out-of-scope wording |
| 7 | Handle source status `not_found` | new | `model.md`, `sync.md`, `integrations.md`, `api.md`, `ui.md` |
| 8 | Awaited `user.deleted` event; the listener deletes the user's rows in all five tables | new | `model.md` |
| 9 | A sync run never creates the sync-state row | new | `sync.md`, `model.md` |
| 10 | `page_cap_reached` counts as `ok`; rows past the cap are trimmed | changed | `model.md`, `sync.md` |
| 11 | The last stored page is requested without `If-None-Match` | changed | `sync.md` |
| 12 | Add's write is conditional on `added_at IS NULL` | changed | `api.md` |
| 13 | Status changes from repo calls are a compare-and-set on `secret_iv` | new | `integrations.md`, `security.md` |
| 14 | `409 REPOSITORY_SOURCE_UNUSABLE` when Add has no candidate | new | `api.md`, `integrations.md`, `ui.md` |
| 15 | Ten UI edge-case rules | new | `ui.md` |
| — | Rows of non-usable integrations are kept until the integration is fixed or deleted | accepted | `integrations.md` |

### Matrix shape and location

- **A dedicated file, `docs/agents/specs/repos/edge-cases.md`**, linked from the README's index
  ("Edge-case matrix: every case, its outcome and the rule behind it").
- **One table per area:** Sync sources, Integrations, Handle, Visibility, Concurrency, Add, User
  deletion, UI.
- **Columns:** Case | Stored state | Row status | Source status | UI | Rule (link to the defining
  section).
- **The matrix is an index, not a second source of truth.** Each row states the outcome in one
  line and links to the rule. A case already settled elsewhere is one row that links there,
  without restating it.
- **A rule that #450 decides goes in its owning file** (`model.md`, `sync.md`, `api.md`,
  `integrations.md`, `ui.md`), never only in the matrix. The matrix row links to it.
- The `> **Open — settled by #450:**` markers in `sync.md#edge-cases` and `ui.md#edge-cases`
  become a short pointer to `edge-cases.md`. The marker in `model.md#logical-foreign-keys` is
  replaced by its rule.

#### Required tests

- **A case settled by an existing rule** cites that rule's existing "Required tests" entry. It
  gets no duplicate.
- **A new rule's test** goes in the owning file's "Required tests".
- **`edge-cases.md` has its own "Required tests"** only for scenario tests that span modules or
  steps. Examples: an integration deleted mid-sync, Add during a sync, a handle changed
  mid-sync.

### Scope

**In scope (docs only, under `docs/agents/specs/repos/`):**

- The new `edge-cases.md` ([Matrix shape and location](#matrix-shape-and-location)).
- Closing #450's three open markers:
  - `model.md#logical-foreign-keys`: the user-deletion cleanup path;
  - `sync.md#edge-cases`: the sync matrix;
  - `ui.md#edge-cases`: the UI edge cases.
- Settling the "#450 may / stays #450's" notes:
  - `api.md#repo-ref`: rename handling and the `fullName` tie-break;
  - `integrations.md`:
    - a dedicated status for a `404` on the handle listing (also in `sync.md#handle-credential`);
    - the rows kept for non-usable integrations;
    - user deletion;
  - `model.md`:
    - whether `page_cap_reached` counts as `ok` for row statuses;
    - the "handle vanished" status;
    - the rest of the Add-vs-pruning matrix.
- **README:**
  - remove the three #450 rows from "Open markers";
  - add #450's decisions to "Decisions summary";
  - add an index row for `edge-cases.md`;
  - add a `#452` checklist entry for any case that changes a permanent doc.
- **Changing a settled rule:** #450 may change a rule in its owning file when a case shows that
  the rule is wrong or incomplete. Every such change is listed in this issue's Solution and in
  the README's decisions summary.

**Out of scope:**

- Code.
- The testing strategy (#451): #450 only adds the "Required tests" entries for its cases.
- New features, which stay excluded by #444:
  - removing a repo;
  - changing an added repo's access link;
  - Add by `owner/name` outside the listing.
- The permanent docs, which #452 folds in.

### Renames and transfers

Matrix rows (area **Sync sources**). Each links to its rule:

| Case | Stored state | Row status | Rule |
|---|---|---|---|
| Repo renamed, or transferred to an owner a source still sees | Same `github_id` upserted: `owner` / `name` / `private` refreshed; `added_at` and `integration_id` untouched. The page's ETag changes, so GitHub answers `200`. Page order is stable (listings sort by `created`). | Unchanged | `model.md#repositories`, `sync.md#write-path` |
| Transferred to an owner no source sees | Every source succeeds without it, so its source rows are deleted. | Not added: pruned. Added: Unavailable. | `model.md#private-metadata-lifecycle` |
| Transferred away from the handle's owner | Drops out of the handle listing (`type=owner`); its `handle` row is deleted. | As above, unless another source still returns it | `sync.md#sources` |
| Transferred back later | Same `github_id` returned again. | An added Unavailable row returns to Added (`added_at` kept). A pruned row is re-inserted as Not added. | `model.md#repositories` |
| Renamed while its only source is failing | Old `owner` / `name` kept until a successful sync. | Unknown (if added) | `sync.md#partial-failures` |
| Add `{ fullName }` with the old name before a sync | No row matches. | `404 NOT_FOUND` | `api.md#repo-ref` |
| Add `{ githubId }` after a rename | The re-check uses `GET /repositories/{id}`, unaffected by the name. | Normal Add | `integrations.md#endpoints-and-parameters` |

**New rule: the `fullName` tie-break** (written in `api.md#repo-ref`, replacing the "#450's"
note).

- A user can hold two rows with the same `owner/name` and different `github_id`s:
  - a stale row (a repo renamed away whose only source failed, or a deleted repo kept as added
    Unavailable);
  - a newer repo now using that name.
- A `{ fullName }` ref resolves to the matching row with the **most recent `last_seen_at`, then
  the highest `id`**: the repo GitHub most recently returned under that name.
- It is deterministic and needs no new error code.
- The UI always sends `githubId`, so only API callers can hit the tie.

Required tests (in `api.md`):

- With two rows sharing a `fullName`, Add by `fullName` resolves to the latest-seen row, then the
  highest `id`.
- Add by `githubId` is unaffected by a rename.

### Several sources; failure vs disappearance

Matrix rows (area **Sync sources**):

| Case | Row status | Rule |
|---|---|---|
| Returned by one `ok` source; another source with a row for it failed | Added | `model.md#row-statuses` |
| Every source holding a row for it failed (or is `pending`, see below) | Unknown. Rows kept, nothing pruned. | `sync.md#partial-failures` |
| Every source succeeded without returning it | Added: Unavailable. Not added: pruned. | `model.md#private-metadata-lifecycle` |
| Private, added; its linked integration fails while another integration still sees it | Added (the link is not dangling) | `model.md#row-statuses` |
| Private, added; its linked integration is `ok` but no longer returns it, while another integration does | Added. The link is kept (re-linking is out of scope). | `integrations.md#access-link-on-add` |
| Two sources return different metadata | Last write wins; a `304` never touches `owner` / `name` / `private` | `sync.md#write-path`, `sync.md#conditional-requests` |

**Rule change: `pending` counts as not-ok for row statuses** (in `model.md#row-statuses`).

- **The case:** a source's first run is interrupted (restart or lost lease) after it applied
  pages. It has source rows but no status row, so it reads `pending`.
- **The change:** **Added** needs a source row from a source whose status is `ok`. **Unknown**
  covers an added repo whose remaining source rows all belong to sources that are not `ok`
  (`error`, `invalid_credentials`, `rate_limited`, or `pending`). `page_cap_reached` is
  settled in topic 9.

**Rule change: the meaning of a listing row's `sources[]`** (in `api.md#listing`, replacing "the
sources that returned it in their latest sync").

- `sources[]` lists **every current source holding a row for the repo, as of that source's last
  applied page**, including failed and `pending` ones. The API shape is unchanged.
- **UI** (`ui.md#table`): each badge is matched by key with the sync state's
  `sources[].status`. The badge of a source that is not `ok` is shown **muted**, with the
  tooltip and accessible label **"<source> could not be refreshed"** (`pending`: **"<source> has
  not been synced yet"**).

Required tests:

- `model.md`: an added repo held only by a `pending` source's rows reads Unknown; one `ok`
  source row makes it Added.
- `api.md`: a row's `sources[]` includes a failed source's entry.
- `ui.md`: a not-ok or `pending` source badge renders muted with its tooltip.

### Integration lifecycle

Matrix rows (area **Integrations**):

| Case | Outcome | Rule |
|---|---|---|
| Deleted between syncs | The hook drops its source, page and status rows, clears `integration_id` and prunes. Added private repos it linked read Unavailable until a sync fills the link (below). Added public repos stay Added. | `integrations.md#deletion-hook`, `model.md#row-statuses` |
| Deleted during a sync | Its source stops silently (new rule below). A page written after the hook's cleanup is dropped by the end-of-sync safety net, before pruning. | `sync.md#write-path` |
| Turned `invalid` mid-sync (a `401` on the handle source through it, or on its own source) | Its own source reads `invalid_credentials` (a `401`, or `integration_unusable` with reason `status`); rows kept. The handle source moves to the next usable integration. | `sync.md#handle-credential` |
| Non-usable between syncs (`expired`, `invalid`, `undecryptable`) | Not called; `invalid_credentials`; rows kept. Added repos it alone holds read Unknown. | `integrations.md#usable-integrations` |
| Type disabled on this server | Not called; `error`; rows kept. | `integrations.md#usable-integrations` |
| Credential replaced, same `github_login` | The cached token is evicted; old ETags miss, so the next sync gets `200`. Rows unchanged in effect. | `sync.md#conditional-requests` |
| Credential replaced, different `github_login` | The old login's rows stay until that source's next sync, which rewrites each page and deletes rows past its last page. Not-added repos only the old login saw are then pruned. Added ones read Unavailable, unless another source returns them. | `sync.md#write-path` |
| Access-linked integration deleted, added repo | Private: Unavailable until a sync fills the link. Public: stays Added (unauthenticated path). | `model.md#row-statuses` |
| Deleted and re-created with the same credential | New `integration:<id>` source reads `pending`, then `ok` after its sync. Links are refilled at the end of that sync. | new rules below |

**Accepted: rows of non-usable integrations are kept until the integration is fixed or
deleted.**

- They hold only the user's own data and are visible only to that user.
- The banner says to fix the integration in Integrations, and deleting it purges its rows at
  once.
- Expiring them (for example after 30 days) was rejected: added repos would flip to
  Unavailable, and a fixed token would re-import everything.
- Replaces the "(#450 may revisit)" note in `integrations.md#usable-integrations`.

**New rule: a missing integration stops its source silently** (in `integrations.md`, `sync.md`).

- `integration_unusable` gains a third reason, **`missing`**: no integration row for that id and
  user.
- The sync stops that source and writes nothing more for it: no status. This mirrors a handle
  changed mid-sync.
- The reason never reaches a response.

**New rule: a fixed integration reads `pending`** (in `api.md#sync-state`).

- On read, a stored `invalid_credentials` status for an integration that is now **usable**
  reports **`pending`**.
- The listing and the sync-state route already load the user's integrations to resolve labels.
- No event and no write: the next sync of that source replaces the status.
- This removes the stale "Fix it in Integrations" banner after Test or Replace.

**New rule: an empty access link is filled at the end of a sync** (in
`integrations.md#access-link-on-add`, `sync.md#write-path`, `model.md#row-statuses`).

- **Where:** the end-of-sync transaction (`run_id`-guarded, every statement
  `AND user_id = :userId`), after the safety net and before pruning.
- **What:** an **added, private** repo whose `integration_id` is empty or dangling gets the
  **oldest usable integration holding a source row for it from a source whose status is `ok`**.
- **Never changes a link that is set and valid.** #444's exclusion is "changing an added repo's
  access link"; filling an empty or dangling one is not a change of a valid link. The README's
  out-of-scope line is reworded to say so.
- **Row status:** unchanged as a rule (private with an empty link reads Unavailable). The row now
  reads Unavailable only until the next sync after the link was lost, unless no usable
  integration returns the repo.

Required tests:

- `integrations.md`: a call for a deleted integration answers `integration_unusable` with reason
  `missing`.
- `sync.md`:
  - a source whose integration is deleted mid-sync writes no status;
  - the end-of-sync fill links the oldest usable `ok` integration to an added private repo with
    an empty or dangling link;
  - it never touches a set, valid link, a public repo or a not-added repo.
- `api.md`: a stored `invalid_credentials` status for an integration that is now usable reports
  `pending`; one still non-usable reports `invalid_credentials`.
- `edge-cases.md` scenarios:
  - delete an integration mid-sync: no status for it, no rows for it after the run, links
    cleared, not-added repos pruned;
  - delete and re-create the same credential: added private repos are Unavailable, then Added
    after the next sync, linked to the new integration.

### Handle

Matrix rows (area **Handle**):

| Case | Outcome | Rule |
|---|---|---|
| Handle unknown, renamed, suspended or deleted on GitHub (`404`) | Status `not_found` (new, below); rows kept; added repos it alone holds read Unknown; nothing pruned. | new rule below |
| Handle names an organization | `/users/{org}/repos?type=owner` lists the org's public repos; accepted. | `integrations.md#endpoints-and-parameters` |
| Handle with no public repos | `ok`, no rows. Not added: pruned. Added: Unavailable unless another source returns them. | `model.md#private-metadata-lifecycle` |
| Handle equals the login of one of the user's integrations | The same repos come through both sources; merged by `github_id`, two source badges. | `sync.md#sources` |
| Handle changed or cleared | The reconciliation on the next Repositories request drops the handle's rows and prunes. A new handle reads `pending`. | `model.md#handle-changes` |
| Handle changed during a sync | The run's handle-source writes are refused by the `handle <=> :runHandle` guard. The handle source stops without a status; the other sources finish. | `sync.md#write-path` |

**New rule: the source status `not_found`** (handle source only). It goes in
`model.md#repositories_source_statuses`, `sync.md#handle-credential`,
`integrations.md#error-mapping`, `api.md#sync-state` and `ui.md#source-errors`, replacing the
"`error` for now; #450 may add a dedicated one" notes.

- **Trigger:** the handle listing's `not_found` result (a `404`), whatever credential served it.
  There is no fallback to another credential: a `404` is not a `401`.
- **Not ok for row statuses:**
  - rows and pages are kept, so nothing is pruned;
  - added repos it alone holds read Unknown;
  - a renamed handle's repos still exist on GitHub under the new name.
- **Retried on every sync.** It is not skipped like `rate_limited`.
- **API:** `sources[].status` gains `not_found`.
- **Banner:** *GitHub handle "darthjee" was not found on GitHub. Check it on your Account page.*
  It links to `#/account/my-account`.

Required tests:

- `sync.md`: a `404` on the handle listing stores `not_found`, keeps the handle's rows and pages,
  prunes nothing, and does not fall back to another credential.
- `model.md`: an added repo held only by a `not_found` handle reads Unknown.
- `ui.md`: the `not_found` banner text links to the Account page.

### User deletion

No user-deletion path exists today. This defines the Repositories contract for when one does,
replacing the open marker in `model.md#logical-foreign-keys` and the "User deletion stays #450's"
note in `integrations.md#deletion-hook`.

**New rule: an awaited `user.deleted` event** (in `model.md#logical-foreign-keys`).

- The future deletion path emits **`user.deleted`** (`UserDeletedEvent { userId }`) with
  `emitAsync`, **after the user row delete commits**. This is the same pattern as
  `integration.deleted`.
- **Repositories' listener** runs one transaction that deletes the user's rows from all five
  tables:
  - `repositories`;
  - `repositories_sources`;
  - `repositories_source_pages`;
  - `repositories_source_statuses`;
  - `repositories_sync_states`.

  Every statement has `WHERE user_id = :userId`.
- **Best-effort:** a failure is logged with safe fields and never blocks the deletion. The
  listener is registered at boot, like the `integration.deleted` one.
- **Why not a physical cascade:** it keeps "logical FKs only", so `integrations.user_id` stays
  the project's only physical cross-module FK. Orphans left by a failed listener are visible to
  no one: MySQL 8 never reuses an auto-increment `id`, so no future user can inherit them. The
  risk is retention, not exposure.
- **Integrations cascade:** the user's integrations go through their own `ON DELETE CASCADE`,
  which emits no `integration.deleted`. The `user.deleted` listener covers their Repositories
  rows anyway.
- #452 records the contract in the Repositories module doc and in `modules/auth.md` (the event
  Auth emits once a deletion path exists).

**New rule: a sync run never creates the sync-state row** (in `sync.md#write-path`,
`model.md#handle-changes`).

- Only the request entry points create it, with `INSERT … ON DUPLICATE KEY UPDATE`:
  - the listing;
  - the sync-state route;
  - Refresh;
  - Add.
- A run's own handle reconciliation, when the run starts, only updates an existing row. With no
  row, the run stops.

Matrix rows (area **User deletion**):

| Case | Outcome | Rule |
|---|---|---|
| User deleted while idle | The `user.deleted` listener deletes the user's rows in all five tables. | new rule above |
| User deleted during a sync | The listener deletes the sync-state row. The run's next guarded write affects no row, so it rolls back and stops. The catch-all release affects no row. Nothing is recreated. | `sync.md#restart-recovery`, new rule above |
| Listener fails | Logged; the deletion stands; the orphan rows are visible to no one. | new rule above |

Required tests:

- `model.md`: the `user.deleted` listener deletes the user's rows from all five tables and no
  other user's rows; its failure is logged and does not throw.
- `sync.md`: a run whose sync-state row was deleted stops at its next write and never recreates
  the row, including through its start-of-run handle reconciliation.
- `edge-cases.md` scenario: delete a user during a sync; no Repositories row of that user remains
  after the run ends.

### Visibility flips

No new rule. Matrix rows (area **Visibility**):

| Case | Outcome | Rule |
|---|---|---|
| Public → private, not added, an integration sees it | The integration's upsert sets `private` and deletes the `handle` row in the same transaction. The row stays, held by the integration. | `sync.md#write-path` |
| Public → private, not added, only the handle saw it | The handle source (public only) succeeds without it, so its row goes and the repo is pruned. | `sync.md#sources` |
| Public → private, added, link set | Added while the linked integration sees it. | `model.md#row-statuses` |
| Public → private, added, no link (added via the handle) | Filled at the end of the same sync with the oldest usable `ok` integration holding a row for it, then Added. If no integration sees it: Unavailable. | [Integration lifecycle](#integration-lifecycle) fill |
| Private → public, not added | The integration still holds it and the handle now returns it: two badges. | `sync.md#sources` |
| Private → public, added (link set, empty or dangling) | Added; a public repo needs no link. A set link is kept, never cleared. | `model.md#row-statuses` |
| Turned private while the only source holding it (the handle) fails | Stays `private = false` (stale) and reads Unknown if added. Only pre-flip public metadata is kept. The handle's next success drops it. | `sync.md#partial-failures` |
| Add of a repo whose visibility flipped since the last sync | The re-check refreshes `private`. A repo now private is linked to the integration that granted it. | `api.md#add` |

Required tests (`edge-cases.md` scenario):

- An added public repo with no link turns private and is returned by an integration. After the
  sync it reads Added, linked to the oldest usable integration that returns it.
- The same repo returned by no integration reads Unavailable.

### Page cap, rate limit mid-sync, `304`

**Rule change: the page cap counts as `ok` and trims past the cap** (in
`model.md#row-statuses`, `sync.md#write-path`, `sync.md#partial-failures`).

- **Row statuses:** `page_cap_reached` counts as **`ok`**. Every row it holds within the cap was
  just returned. This settles the `model.md` "page cap reached" open note.
- **End of a source on the cap:** delete its source rows and page rows **past the cap**, as for a
  success whose last page is the cap; pruning then applies. This replaces "nothing past the cap
  is deleted".
- **Why:** listings sort by `created` ascending, so new repos land past the end and deletions only
  pull repos toward earlier pages. Rows past the cap exist only after the cap was **lowered**.
  The source never fetches them again, so keeping them would let private metadata outlive any
  check.
- The banner still says some repositories may be missing.

**Rule change: the last stored page is requested unconditionally** (in
`sync.md#conditional-requests`).

- **The gap:**
  - the last stored page N is full (100 repos) with `has_next = false`;
  - a newly created repo goes to page N+1 and leaves page N's body unchanged;
  - page N answers `304`, the stored `has_next = false` stops the source, and the new repo is
    never fetched.
- **The fix:** the page whose stored `has_next` is `false` is always requested **without
  `If-None-Match`**, so its fresh `Link` header decides whether to go on. Every other page still
  sends its `etag`.
- **Cost:**
  - one full request per source per sync;
  - authenticated, 1 of GitHub's 5000/h;
  - unauthenticated, a `304` already costs the same as a `200`.
- Deletions and renames change page bodies, so they already answer `200`.

Matrix rows (area **Sync sources**):

| Case | Outcome | Rule |
|---|---|---|
| Source has more pages than the cap | Pages up to the cap applied; `page_cap_reached` (counts as `ok`); rows and pages past the cap deleted, then pruned. Banner: some may be missing. | rule change above |
| Cap lowered by config | The next sync of a large source trims rows past the new cap. Not added: pruned. Added: Unavailable unless another source returns them. | rule change above |
| Rate limit mid-source (authenticated `403`/`429`, or the unauthenticated threshold) | Pages already applied kept; `rate_limited` with `resetAt`; the rest keep their old rows; added repos held only there read Unknown. Skipped with no call until `resetAt`. The handle source does not fall back. | `sync.md#rate-limits`, `sync.md#partial-failures` |
| `304` on a page before the last | Rows kept, `last_seen_at` set, metadata untouched; the stored `has_next` (`true`) continues. | `sync.md#conditional-requests` |
| New repo created after a full last page | The last page is re-requested without `If-None-Match`; its `Link` shows `rel="next"`; the new page is fetched. | rule change above |

Required tests (`sync.md`):

- `page_cap_reached` counts as `ok` for row statuses.
- Reaching the cap deletes the source and page rows past it, then prunes. This replaces the
  existing "nothing past the cap is deleted" test.
- The last stored page is requested without `If-None-Match`; earlier pages send their `etag`.
- With a full last page and a new repo, the next sync fetches the new page.

### Concurrency

**Rule change: Add's write is conditional** (in `api.md#add`, step 6, and its race notes).

- Step 6 becomes
  `UPDATE … SET added_at, integration_id, snapshot WHERE id = :id AND user_id = :userId AND added_at IS NULL`.
- Zero rows ⇒ re-read the row:
  - **added** ⇒ `200` with the current row. This is idempotent: the first Add's `addedAt` and
    link are kept.
  - **missing** ⇒ `404 NOT_FOUND` (pruned meanwhile; the existing race rule).
- The losing request's GitHub call is wasted, which the per-user Add rate limit bounds.

**New rule: the invalidation compare-and-set** (in `integrations.md#invalid-on-401` and
`integrations.md#github-app-installation-tokens`).

- Every status change caused by a repo call is conditional on the credential that the call used:
  - a `pat` / `oauth_app` `401` ⇒ `invalid`;
  - a mint `404` / `403` ⇒ `invalid`;
  - a decrypt failure ⇒ `undecryptable`.
- The write is
  `UPDATE integrations … WHERE id = :id AND user_id = :userId AND secret_iv = :ivUsed`.
- `secret_iv` is fresh on every encryption. A Replace, or a key rotation, between the call and
  the write therefore makes the write a no-op. A freshly replaced credential is never marked
  `invalid` by a request made with the old one.
- No new column. A missed invalidation after a key rotation recurs on the next call.

Matrix rows (area **Concurrency**):

| Case | Outcome | Rule |
|---|---|---|
| Two tabs open a stale listing | One sync (atomic claim); both get stored rows and the same sync state. | `sync.md#per-user-lock` |
| Refresh during a sync | `202` with the running sync; cooldown not reset. | `api.md#refresh` |
| Refresh in another tab inside the cooldown | `429` + `Retry-After`. | `api.md#refresh` |
| Double Add of the same repo | One write wins; the other answers `200` with the first's `addedAt` and link. | rule change above |
| Add during a sync's upsert | Independent columns (the upsert never touches `added_at` / `integration_id`); metadata last-write-wins, both from GitHub. | `sync.md#write-path` |
| Add vs the end-of-sync link fill | The fill's `UPDATE` matches only an empty or dangling `integration_id` (`IS NULL OR NOT IN (:userIntegrationIds)`), so it never overwrites Add's link. | [Integration lifecycle](#integration-lifecycle) fill |
| Add vs pruning | Existing rule: Add first ⇒ kept; pruning first ⇒ `404`. | `model.md#private-metadata-lifecycle` |
| Integration deleted during Add (after its re-check) | The link is written dangling, read as empty (private ⇒ Unavailable), and refilled by the next sync. | `model.md#logical-foreign-keys` |
| Credential replaced during a sync | The in-flight old-credential `401` is a no-op on the status (CAS); the source reads `invalid_credentials` for this run, and the fixed integration reads `pending` (topic 5) until the next sync. | new rule above |
| Handle changed during a sync | The handle guard stops the handle source without a status. | `sync.md#write-path` |
| Two backend instances | The claim lives in the database; the budget tracker is per instance and corrected by GitHub's headers. | `sync.md#rate-limits` |

Required tests:

- `api.md`: two concurrent Adds of the same repo write once; both answer `200` with the same
  `addedAt` and link.
- `integrations.md`: a `401` from a call made before a Replace leaves the replaced integration
  `active`; a `401` with the current credential sets it `invalid`.
- `edge-cases.md` scenario: Replace a credential during a sync. The integration stays `active`
  and reads `pending`, then `ok` after the next sync.

### Add after access was lost

**New rule: `409 REPOSITORY_SOURCE_UNUSABLE`** (in `api.md#add`, `api.md#errors`,
`integrations.md#add-re-check-candidates`, `ui.md#table`).

- **When:** the candidate walk has **zero candidates before any GitHub call**:
  - every source holding the repo is a non-usable integration (`expired`, `invalid`,
    `undecryptable`, or type disabled);
  - and the handle source does not hold it.
- **Answer:** `409` with code `REPOSITORY_SOURCE_UNUSABLE` and message
  `The integration that sees this repository needs attention.`. No GitHub call, nothing written.
  The code is added to `core/error-codes.ts`.
- **Denials still answer `404`.** Once at least one candidate was called and every one denied
  it, or the 3-call cap was reached, the answer is `404 NOT_FOUND` as today.
- **Why it is safe:** the decision reads only the caller's own row and own sources, so it
  reveals nothing about other users or about GitHub.
- **UI inline error:** "Fix the integration that sees this repository in Integrations.", linking
  to `#/account/integrations`.

Matrix rows (area **Add**):

| Case | Walk | Answer | Rule |
|---|---|---|---|
| Repo deleted on GitHub since the last sync | Every candidate answers `404` | `404`, nothing written; the row stays Not added until the next sync prunes it (no write outside a sync) | `api.md#add` |
| Integration lost access (removed from an org, app uninstalled from the repo) | `404` / `403` ⇒ next candidate | `404` if no candidate grants it | `integrations.md#add-re-check-candidates` |
| Token revoked | `401` ⇒ `pat` / `oauth_app` set `invalid` (compare-and-set), next candidate | as above | [Concurrency](#concurrency) CAS |
| Turned private; only the handle saw it; another usable integration has access | The remaining usable integrations are tried, oldest first | `200`, linked to the granting integration | `api.md#add` |
| Turned private; nobody has access | Every candidate denies it, including the unauthenticated call | `404` | `api.md#add` |
| Only non-usable integrations hold it; the handle does not | No candidate | `409 REPOSITORY_SOURCE_UNUSABLE` | new rule above |
| Rate limit, `5xx`, timeout, redirect | The walk stops | `503` / `502` | `api.md#add` |

Required tests:

- `api.md`:
  - Add with only non-usable sources answers `409 REPOSITORY_SOURCE_UNUSABLE` with no GitHub
    call and no write;
  - with one usable candidate that denies it, Add answers `404`.
- `ui.md`: the `409` shows the inline error with the Integrations link.

### UI edge cases

New rules, written in `ui.md` (replacing the open marker in `ui.md#edge-cases`) and listed in
`edge-cases.md` (area **UI**):

| Case | Rule |
|---|---|
| Page emptied by the reload after a sync (the user is on page 3, the total shrank) | If the reload returns no items on a page above 1, jump to the last page (from `total`) and reload once. |
| Row changes status during a sync | Rows stay as loaded until the reload when the sync goes idle. No row updates while syncing. |
| Add in flight, or its result, when the reload lands | Add state (spinner, inline error) is kept by `githubId` across the reload. It is cleared on success or on navigation. |
| Added under the "Not added" filter | The row turns Added and stays visible until the next reload or filter change, so the list does not jump under the cursor. |
| Add on a row pruned meanwhile | The `404` inline error shows; the row disappears on the next reload. |
| Handle source and `invalid_credentials` | Cannot happen: after a `401` the handle falls back to the next integration, then to the unauthenticated call, which cannot get a `401`. Rule: only integration sources show the `invalid_credentials` banner. |
| Dismissed banners | Dismissal is kept in memory per (source, status, `syncedAt`). The banner comes back when a new sync stores a failure again, or on a page reload. |
| Integration deleted while the page is open | Its badges and banner disappear at the next reload (`sources[]` drops it). |
| Sources exist but the sync found no repos | A distinct empty state, "No repositories found. Check the sources above.", different from the no-handle, no-integration empty state. |
| Filter or search with no matches | "No repositories match your filters." |

Also from earlier topics, for `ui.md`:

- muted source badges with their tooltips ([Several sources](#several-sources-failure-vs-disappearance));
- the `not_found` banner ([Handle](#handle));
- the `409 REPOSITORY_SOURCE_UNUSABLE` inline error ([Add after access was lost](#add-after-access-was-lost)).

Required tests (`ui.md`): one per row above.

- An empty page above 1 after a reload jumps to the last page.
- Rows do not change while syncing.
- Add state survives the reload.
- An Added row stays under the "Not added" filter until reload or a filter change.
- Only integration sources show the `invalid_credentials` banner.
- A dismissed banner stays hidden for the same (source, status, `syncedAt`) and returns for a new
  `syncedAt`.
- A deleted integration's badge and banner disappear on reload.
- The two empty states and the no-match message render in their cases.

### Performance and security

No new decision. Assessment of the rules above:

**Performance**

- **Last page requested unconditionally:**
  - one full request per source per sync;
  - authenticated, 1 of GitHub's 5000/h;
  - unauthenticated, no extra cost, since a `304` already counts.
- **End-of-sync link fill:** one user-scoped `UPDATE` in the existing final transaction, using
  the (`user_id`, `integration_id`) index.
- **Trimming past the cap and the `user.deleted` cleanup:** bounded, user-scoped deletes. The
  trim also reduces retention.
- **Conditional Add write and the `secret_iv` compare-and-set:** the existing update with one more
  `WHERE` clause.
- **A fixed integration reading `pending`:** uses the integrations already loaded to resolve
  labels; no extra query.

**Security**

- **`409 REPOSITORY_SOURCE_UNUSABLE`:**
  - decided after the Add rate limit and the lookup in the caller's own rows;
  - decided only from the caller's own sources;
  - reveals nothing about other users or GitHub, and gives no probing surface.
- **The `not_found` handle status** only says that a public GitHub login does not exist.
- **The `secret_iv` compare value stays inside the Integrations module.** It never reaches
  Repositories, a response or a log. This line is added to
  `security.md#credentials-stay-in-the-backend`.
- **Data kept or deleted:**
  - rows of non-usable integrations are kept (accepted; visible only to their owner);
  - orphans left by a failed `user.deleted` listener are visible to no one (retention, not
    exposure);
  - trimming past the cap and filling empty links both tighten the private-metadata lifecycle.
- **UI:** banner dismissal is kept in memory (no `localStorage`); muted badges add no data.

Required tests (`security.md`): no Repositories code, response or log carries `secret_iv`.

### Backward compatibility

Not applicable. #450 changes only the temporary specs under `docs/agents/specs/repos/`, and the
feature is not implemented yet, so no behaviour, data or API can break.

## Benefits

- **One place to check behaviour.** Every edge case has a defined, linked outcome before
  implementation starts, so the implementation issues and their tests have no ambiguity.
- **Real defects fixed in the specs, before any code exists:**
  - the `304` blind spot;
  - double Add;
  - the replace-vs-`401` race;
  - links lost forever;
  - rows kept past a lowered cap.
- **Tighter private-metadata lifecycle:** rows past the cap are trimmed, links are refilled,
  and user deletion is defined.
- **Clearer feedback for the user:** the `not_found` handle status, muted badges, a `409` that
  says why Add is impossible, and no stale "fix it" banners.
- **#451 and #452 start from specs with no #450 open points left.**
