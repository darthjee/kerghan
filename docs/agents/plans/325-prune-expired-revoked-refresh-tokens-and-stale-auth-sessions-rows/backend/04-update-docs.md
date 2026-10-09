# Update docs
Remove `auth_sessions` from the docs and describe the pruning:
- `docs/agents/modules/auth.md`: drop the `auth_sessions` table entry and the "`auth_sessions` is unrelated bookkeeping" sentence in the sessions section. Note on `auth_refresh_tokens` that a user's expired rows are deleted on each mint, and why revoked-but-unexpired rows are kept (replay detection). Note on `auth_password_reset_tokens` that a user's expired/used rows are deleted on each mint.
- `docs/agents/architecture/backend.md`: remove the `auth_sessions` row from the tables table.

Leave historical plan files (e.g. `docs/agents/plans/24-*`) untouched.

## Files to Change
- `docs/agents/modules/auth.md` — remove the `auth_sessions` mentions; document the pruning.
- `docs/agents/architecture/backend.md` — remove the `auth_sessions` table row.
