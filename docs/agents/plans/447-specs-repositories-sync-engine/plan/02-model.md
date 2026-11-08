# model.md: schema, last_seen_at, pruning

In `docs/agents/specs/repos/model.md`:

- **Tables:** replace the #447 marker with the conventions paragraph, the `source_key` rule and
  the five-table table (columns, types, indexes) from the issue; rename the working names to the
  final ones (`repositories`, `repositories_sources`, `repositories_source_pages`,
  `repositories_sync_states`, `repositories_source_statuses`).
- **`repositories`:** `github_id bigint` mapped to a JS number, `owner varchar(39)`,
  `name varchar(100)`; `last_seen_at` redefined ("when a source page last returned the repo",
  informational); the index list made exact.
- **Sources table / Sync state:** the `page` column; `last_started_at` as the never-cleared
  cooldown anchor, `run_id`, `heartbeat_at`; per-source statuses in their own table, `pending`
  when no row.
- **Private metadata lifecycle:** replace the pruning marker with the orphan rule, when it runs
  (end of sync, after the deletion hook, after a handle change), and the Add race.
- **Logical foreign keys:** the deletion hook also drops the integration's page and status rows,
  then prunes.
- **Required tests:** unique (`user_id`, `github_id`) with `bigint`; orphan pruning; page/status
  rows dropped with their integration.

## Files to Change
- `docs/agents/specs/repos/model.md` — the sections above.
