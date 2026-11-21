# Marker upsert and sync-trigger port

## `issue-markers.ts` — `IssueMarkers`

`upsertForEdit(manager, issueId, now): Promise<number | null>` runs inside the edit transaction, after the issue row is locked and updated. It follows the lock order: issue → link → marker.

1. Run `SELECT id, status FROM issues_github_links WHERE issue_id = ? FOR UPDATE`. If there is no row, return `null` (an unlinked issue gets no marker).
2. If `status = 'gone'`, return `null` (local edits only, E1). Only `linked` and `sync_failed` continue (`sync.md#marker-lifecycle`).
3. Run `INSERT INTO issues_pending_writes (link_id, revision, marked_at, updated_at) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE revision = revision + 1, updated_at = VALUES(updated_at)`:
   - `marked_at` is set only on insert;
   - `updated_at` and `revision` move on every value-changing edit;
   - the timestamps come from `stampOf(clock)`.
   - Use the MySQL 8 row-alias form if the codebase avoids the deprecated `VALUES()`; check what the project's MySQL version accepts without warnings.
4. Return the link id.

The caller calls it **only when the edit changed a synced field** (title, body or state). All three of the stored fields are synced, so in practice: only when `changes` is non-empty (E12).

`hasLink(manager, issueId): Promise<boolean>` is for delete. It runs `SELECT id FROM issues_github_links WHERE issue_id = ? FOR UPDATE`. Locking it keeps the order and guards against a concurrent attach. A link in any status counts.

## `issue-sync-trigger.ts` — the port

```ts
/** After-commit hook of local edits that bumped a marker (T1, sync.md#triggers). */
export abstract class IssueSyncTrigger {
  abstract afterCommit(linkIds: number[]): void;
}

/** #556 default: nothing is enqueued yet. The marker is the durable record and the boot sweep (T5) re-enqueues it. #558 binds the real enqueue through the per-link dedupe. */
@Injectable()
export class NoopIssueSyncTrigger extends IssueSyncTrigger {
  afterCommit(): void {}
}
```

- The service calls `afterCommit` **only after the transaction resolves**, and only with the link ids that `upsertForEdit` returned. It is never called on rollback, and never with an empty list.
- The call is synchronous and must never fail the request: a thrown error is caught and logged with link ids only (never content), and the response is still `200`. This matches "an enqueue failure is handled as in the single Edit" in `api/issues.md`.
- Bound in the module as `{ provide: IssueSyncTrigger, useClass: NoopIssueSyncTrigger }`. #558 swaps the `useClass`.

## Files to Change

- `backend/src/issues/issue-markers.ts` — the marker upsert and the link check.
- `backend/src/issues/issue-sync-trigger.ts` — the port and its no-op.
