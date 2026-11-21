# Issue: Issues specs: open-issue counts and bulk close/reopen in the API

## Description

Part of the epic #483 (Issues and Projects). While enhancing the UI spec (#491), two additions were brought into v1 that need API decisions that `docs/agents/specs/issues/api.md` (#489) left out: an **open-issue count** on the project list, and **bulk close/reopen** on the issue list. This issue amends the Issues and Projects specs with those decisions. It is documentation only: no code, migrations or endpoints (#563 builds them).

## Problem

- `ui.md` and `ui/states.md` already specify the count on project rows and the bulk bar, but mark them "API in #507": the API they call is undefined.
- `api.md` and `projects.md` still say "no issue counts in v1", and the route list stops at 18 routes.
- Without a decided contract, #563 would have to make its own decisions about the count's cost, the bulk call's outcome reporting, its transaction and lock order, its rate-limit weight and its validation, which the specs lifecycle forbids.

## Expected Behavior

- `api.md` (and its `api/projects.md`, `api/issues.md`, `api/errors-and-validation.md` pages) specifies `openIssueCount` and `POST /projects/:projectId/issues/bulk-state.json` with no open questions; the route list and count read 19 and the Required tests cover the new route.
- `projects.md`, `model.md`, `security.md`, `edge-cases.md` (E66 to E74) and `testing.md` are consistent with it.
- `ui.md` and `ui/states.md` no longer say "API in #507"; they link to the decided API and use its response shape.
- No code, migrations or endpoints are added.

## Solution

Responsible agent: `architect`. Documentation only. Every decision below was settled when the issue was enhanced; the implementation is #563.

### Scope

**In scope (documentation only):**

- `openIssueCount` on **every** project object (listing row, show, create, from-repository, edit), so the project keeps a single shape; single reads pay one indexed `COUNT`.
- One new route, `bulk-state.json`, changing `state` only (close/reopen). No other fields in bulk.
- Bulk applies to issues in any link state with the same rules as a single Edit: a `linked`/`sync_failed` issue gets its marker and a T1 after commit, a `gone` issue changes locally only.
- Amendments to `api.md` (route list, count 18 → 19, Required tests), `api/projects.md`, `api/issues.md`, `api/errors-and-validation.md`, and the matching parts of `projects.md` (fields), `security.md` (rate-limit weight), `edge-cases.md`, `testing.md` and `model.md` (index usage).
- `ui.md` and `ui/states.md` made consistent: the "API in #507" markers replaced by pointers to the decided shapes.

**Out of scope:**

- Other counts (closed, linked, sync failed, total).
- Other bulk actions (delete, refresh, unlink, bulk import).
- Selection across pages or "all matching the filter" (the UI selects within one page, at most 100).
- An open-issue count anywhere other than the project-list row in the UI.
- Code, migrations and endpoints (built by #563).

### Open-issue count

- **Definition.** `openIssueCount` is the number of the project's issues whose stored local `state` is `open`, whatever their link state. A linked issue counts by its local state (sync pulls GitHub's state into it); a pending local close counts as closed at once.
- **Contract: the value may lag.** Clients must not assume it matches the issue listing's `pagination.total` for `state=open` or reflects a write made a moment earlier. This leaves room for a later cache without an API change.
- **v1 computation: at read time**, no stored column and no cache (so in practice it is exact today).
  - **Listing:** one extra grouped query per page, `SELECT project_id, COUNT(*) FROM issues WHERE project_id IN (:pageIds) AND state = 'open' GROUP BY project_id`, served by the (`project_id`, `state`) prefix of `idx_issues_project_id_state_created_at`. Projects absent from the result read `0`. Never one query per project.
  - **Show, edit, repository change, shortcut's existing-project `200`:** one indexed `COUNT` for the single project. Create and the shortcut's new-project `201` return `0` without querying.
- **Cost bound:** every count is bounded by the per-project issue cap (`ISSUES_LIMIT_REACHED`).
- **Not added:** sorting or filtering projects by count; the count on the issue listing (its `pagination.total` already serves that).
- **Rejected:** a stored counter column on `issues_projects`, which every write path (create, edit, bulk, import, sync pull, delete, project deletion) would have to maintain and which could drift.

### Bulk route shape

`POST /projects/:projectId/issues/bulk-state.json`, body `{ issueIds: [uuid…], state: "open" | "closed" }`.

Response, always `200` once the project resolves:

```json
{
  "state": "closed",
  "changed":   ["8b1e…04"],
  "unchanged": ["…"],
  "notFound":  ["…"]
}
```

- **Per-issue outcomes, not all-or-nothing.** Every requested id appears in exactly one list, in request order.
  - `changed`: the local state was flipped by this call. A linked issue counts as changed even though its GitHub push is still pending (T1 enqueued), matching the single Edit.
  - `unchanged`: already in the target state (E12: no write, no marker, no revision bump).
  - `notFound`: no issue with that id in **this** project (missing, another project's or user's, or deleted concurrently), all indistinguishable.
- **Ids only, no issue objects:** the UI re-reads the page after the call, so rows (and their link loading) are not returned. `state` is echoed so the response is self-contained.
- **Always `200`**, even when every id is `notFound` or `unchanged`. A missing, foreign or deleted project still answers `404`; `400` and `429` happen before any work.
- **UI mapping:** the summary notice uses `changed.length` and `unchanged.length` ("Closed 8 issues; 2 were already closed"); a non-empty `notFound` adds "N were no longer found"; the page is then re-read.
- **Rejected:** `207 Multi-Status` (no precedent in the codebase); all-or-nothing on any `notFound` (one concurrent delete would fail the page's action); returning updated rows (the re-read covers it).

### Transaction and locks

**Order of checks** (as the single Edit): DTO validation (`400`) → edit rate limit weighted by the id count (`429`) → project access check (`404`) → transaction.

**One transaction for the whole call** (at most 100 rows, no chunking), in the module's lock order (projects, issues, links, markers):

1. **Lock the project row** (`FOR UPDATE`, live only). Deleted since the access check: roll back, `404`.
2. **Resolve and lock the issues** in one query, `WHERE project_id = :p AND uuid IN (:ids) ORDER BY id FOR UPDATE`. Internal-id order keeps two overlapping bulk calls from deadlocking. Ids not returned go to `notFound`.
3. **Flip `state`** on each issue whose state differs from the target, with `updated_at` from one `Clock` read for the whole call. Issues already in the target state are `unchanged` and get no write.
4. **Links and markers** for the changed issues: load their links in one query, lock them in id order, and upsert the marker of each `linked`/`sync_failed` link (`marked_at` on insert, `updated_at` and `revision` on every change). `gone` links get no marker (local only).
5. **Commit.**
6. **After the commit**, enqueue one T1 per changed `linked`/`sync_failed` link. An enqueue failure is handled as in the single Edit (the marker is the durable record; the boot sweep re-enqueues). Nothing is enqueued on rollback.

**Concurrency:**

- Bulk vs bulk, attach, delete or unlink: serialized by the project-row lock; an issue deleted first ends up in `notFound`.
- Bulk vs single Edit: the single Edit is **left unchanged** (no project lock added); it holds one issue then its link and marker, so the lock order prevents a deadlock.
- Bulk vs reconcile commit: same lock order and compare-and-clear; a marker bumped by the bulk call makes the reconcile miss its clear and re-enqueue (T6).
- A database error rolls the whole call back (`500`): nothing applied, nothing enqueued. Partial results come only from `unchanged` and `notFound`, never from failures.

**Rejected:** one transaction per issue (half-applied pages on failure, 100 round-trips); chunking (unneeded at 100 rows); no project lock (races with attach and project deletion).

### Rate limit

- **Weight = `issueIds.length`** against the existing edit window (`KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW`, default 120 per `KERGHAN_ISSUES_EDIT_WINDOW_MS`, 60000). No new limit or env var.
- Checked, as for the single Edit, **after DTO validation and before the access check**, so `notFound` and `unchanged` ids count too ("every attempt counts", which also bounds probing). The changed count is not known yet at that point.
- **All-or-nothing:** if `used + weight > max`, the call answers `429 ISSUE_EDIT_RATE_LIMITED` with `Retry-After` and `error.retryAfterSeconds` (time to the window reset) and nothing is applied.
- **A refused call consumes nothing**, so retrying a 100-id call cannot keep the window full. `security.md` states this explicitly for the single Edit too.
- Consequence with the defaults: one full page of 100 per minute; a second full page right after waits up to about 60 s, shown through the UI's existing "Try again in N s" countdown.
- **Rejected:** a separate bulk window (up to 1000 marker writes and enqueues per minute, plus a new env var); raising the default edit max (loosens the single-edit limit too).

### Edge cases

New group "Counts and bulk" in `edge-cases.md`, ids continuing after E65, status `Contract`, one required test each; E66 to E69 are `(db)`.

| # | Case | Expected behaviour |
|---|---|---|
| E66 | An id in the call is deleted before the issue lock | It goes to `notFound`; the other ids apply. |
| E67 | Bulk races a project deletion | Deletion first: the bulk re-check under the project lock answers `404`, nothing applied. Bulk first: its changes apply, the deletion then removes the issues, and the queued T1 jobs no-op (existing job guard). |
| E68 | Bulk races an attach on one of its issues | Serialized by the project lock. Attach first: the issue is linked, so the bulk writes its marker and a T1. Bulk first: `updatedAt` moved, so an attach confirmation answers the stale `409` and the warning is shown again (E61). |
| E69 | Two overlapping bulk calls set opposite states on the same issues | Serialized (id-order locks, no deadlock); the last commit wins; each call reports its own outcome. |
| E70 | Every id is `unchanged` or `notFound` | `200`, no writes, no markers, no enqueues; the rate-limit weight is still consumed. |
| E71 | Linked issues whose GitHub side differs, or whose integration is paused, lacks a credential, or whose repository is Unavailable | Same as a single Edit: marker written, T1 enqueued, then the existing conflict and wait/failure rules apply (E17 to E22). No new rule. |
| E72 | `gone` links among the ids | Local state change only, no marker, no T1; counted in `changed`. |
| E73 | A listing project with no open issues, or deleted between the page query and the count query | `openIssueCount: 0` (acceptable under "may lag"). |
| E74 | A rate-limited bulk call (`429`) | Nothing applied, nothing consumed; a retry after `Retry-After` succeeds. |

### Backward compatibility

None of the implementation issues (#555 to #564) has started, so no code or data changes are involved; only specs and the split.

- **API additive only:** the project object gains `openIssueCount` and one route is added. No existing field, route, error code or `error.meta` changes; no new error codes. The clarification "a refused `429` edit consumes nothing" also applies to the single Edit (not built yet, so no cost).
- **Spec lines revised:**
  - `projects.md` (fields) and `api/projects.md`: "No issue counts or sync info in v1" → "No issue counts other than `openIssueCount`; no sync info".
  - `api.md` hub: "18 routes" → 19, in the route list and the Required tests access matrix.
  - `ui.md` and `ui/states.md`: the "API in #507" markers replaced by links to the decided API.
- **Ownership across the split (unchanged):**
  - The count stays in **#563**: #555 builds the project object without it; #563 adds the field, the grouped query and its UI. Moving it into #555 would make #555 wait on #507.
  - The route access matrix: #559 covers the 18 routes; #563 adds the 19th route's row in its own PR (the matrix is checked against the registered routes, so a missing row fails).
  - #564 already waits on #507 and #563.
- **Navi and cache:** the new route is `user-scoped`; nothing warmed, nothing new for the cache agent.
- **Database:** no migration; the count uses the existing index and bulk the existing columns.

### Validation and errors

New rows in `api/errors-and-validation.md`'s Input validation table (existing rules still apply: strict types, unknown properties stripped, `400 VALIDATION_FAILED` with `error.details` before any lookup or write, path `:projectId` through `ParseUUIDPipe`):

| Field | Route | Rule |
|---|---|---|
| `issueIds` | bulk-state | **Required** array of 1 to 100 uuid strings. Wrong type, `null`, empty, more than 100, a non-string item or a malformed uuid → `400`. |
| `issueIds` (duplicates) | bulk-state | **Rejected with `400`**, compared case-insensitively, never deduplicated, so each requested id maps to exactly one outcome. |
| `state` | bulk-state | **Required**, `open` or `closed`; no default. |

- **Uuid case:** ids are matched lowercased (stored uuids are lowercase from `randomUUID()`) and echoed lowercased in the response.
- **Body size:** 100 uuids is about 4 KB, well under the global body limit; no new limit.

**Errors, in order of checks:** `401` (no session) → `403` (`OriginGuard`) → `400 VALIDATION_FAILED` → `429 ISSUE_EDIT_RATE_LIMITED` (`Retry-After`, `retryAfterSeconds`) → `404 NOT_FOUND` (project missing, foreign or deleted, including mid-call, E67) → `500` on a database error (full rollback).

- **No new codes, no new `error.meta`.** The catalogue's `ISSUE_EDIT_RATE_LIMITED` row names the bulk route next to Edit.
- Per-issue problems are never errors; they are the `notFound` and `unchanged` outcomes.

### Testing strategy

Required tests the amended specs list (implemented by #563):

- **Route access matrix** extended to 19 routes: the bulk route answers `401` without a session, runs `OriginGuard`, sends `X-Skip-Cache: true` and `Cache-Control: no-store`, declares `user-scoped`, answers no `GET`; another user's or a deleted project answers `404`.
- **Count:** `openIssueCount` on every project object; the listing issues exactly one grouped count query per page whatever the page size `(db)`; projects without open issues read `0`; linked issues count by local state.
- **Bulk outcomes:** `changed`/`unchanged`/`notFound` in request order, ids of another project or user as `notFound`, `state` echoed, ids only.
- **Transaction:** lock order (project, issues in id order, links, markers) `(db)`; markers for `linked`/`sync_failed`, none for `gone`; one T1 per changed linked non-`gone` issue, only after commit; full rollback and no enqueue on a database error.
- **Rate limit:** the weight is the id count; the boundary (`used + weight = max` passes, `+1` answers `429`); a refused call consumes nothing (bulk and single Edit); `Retry-After` follows the `FakeClock`.
- **Validation:** every row of the new validation table, including case-insensitive duplicates and 100 vs 101 ids.
- **Edge cases:** E66 to E74, one test each; E66 to E69 `(db)`.
- **Frontend** (in #563): the count on project rows and the bulk bar, selection and summary notice per `ui/states.md`, using the response shape above.

## Benefits

- #563 builds the counts and bulk actions against a complete contract, with no decisions of its own.
- The count costs one grouped indexed query per listing page and no stored counter that could drift.
- Bulk close/reopen reuses the single Edit's rules (markers, T1, edit rate limit), so sync behaviour stays the same whether an issue is closed alone or in bulk.
- The change is additive: no existing route, field or error code changes, and no migration.
