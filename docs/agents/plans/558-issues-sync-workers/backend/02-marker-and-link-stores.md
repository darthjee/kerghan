# Marker and link store operations

Extend the stores with the guarded writes of `sync.md#marker-lifecycle` and `model.md`:

- **`IssueMarkers`:**
  - `compareAndClear(manager, linkId, revision): Promise<boolean>`, which runs `DELETE ... WHERE link_id = ? AND revision = ?`.
  - `findRevision(manager, linkId, {lock})`.
  - `listForBoot(): Promise<number[]>`, the link ids ordered by `marked_at` ascending.
  - `deleteForLink` inside the `gone` transaction.
- **Link store:**
  - Lock the link for the reconcile commit; the commit applies only if the link still exists and is not `gone` (E1 race, E32).
  - Write the base snapshot, `github_updated_at`, `last_synced_at` and `etag` (stored from a `200` `GET`, set to `NULL` after a `PATCH`).
  - Status transitions:
    - `linked` with reason `NULL`;
    - `sync_failed` with one of `retries_exhausted`, `no_credential`, `credential_invalid` or `forbidden` (the latest reason overwrites);
    - `gone` with `deleted` or `moved`, which also discards the marker in the same transaction.
  - A per-project listing of non-`gone` links for T3, ordered by `last_synced_at` ascending with NULL first, together with whether each has a marker.
- **Normalization:** add one function that produces stored values from GitHub values (a blank body becomes `NULL`, nothing else changes), and one comparison where `NULL` equals `''`. Both are used by the merge and by the link creation path if it doesn't already share them.

Keep the lock order: projects, issues, links, markers.

## Files to Change

- `backend/src/issues/issue-markers.ts` and specs
- `backend/src/issues/issue-link-store.ts` and specs
- `backend/src/issues/issue-sync-values.ts` (new, or reuse an existing normalizer): normalization and comparison
