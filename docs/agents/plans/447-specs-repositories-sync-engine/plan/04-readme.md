# README: markers, decisions summary, #452 checklist

In `docs/agents/specs/repos/README.md`:

- Open markers table: remove the four #447 rows (`model.md#tables`,
  `model.md#private-metadata-lifecycle`, `sync.md#execution`, `sync.md#values`) and the
  `ui.md#sync-ux` row.
- Decisions summary: add in-process sync with lease recovery, page-number pagination with stored
  ETags, orphan pruning, and the five tables; adjust the "Asynchronous sync" bullet.
- "Product changes folded by #452": add `KERGHAN_REPOSITORIES_SYNC_TTL_MS`,
  `KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS`, `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP` to the
  `environment-variables.md` bullet.
- Index: mention pagination, pruning and the lock in the `sync.md` / `model.md` rows.

## Files to Change
- `docs/agents/specs/repos/README.md`
