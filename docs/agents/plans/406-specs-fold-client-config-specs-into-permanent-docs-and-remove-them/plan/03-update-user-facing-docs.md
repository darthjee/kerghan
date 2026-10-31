# Update user-facing and index docs

- `README.md`, "Run Kerghan standalone" → "Configuration (`~/.kerghan/`)": say that
  `kerghan configure` (scriptable) and `kerghan wizard` (interactive) change both files, with a
  link to `docs/agents/standalone/client-config.md`. Also complete the `~/.kerghan/config` key
  list in the table (add `auto-login`, `bind`) while there.
- `standalone/config.example` header: add a line that `kerghan configure key=value` or
  `kerghan wizard` writes these settings without hand-editing.
- `docs/agents/environment-variables.md`, standalone section, "Optional pass-through" row: next
  to "Add them to `~/.kerghan/kerghan.env`", mention `kerghan configure KEY=value`.
- `docs/agents/folder-structure.md`, `docs/agents/` table: add a `standalone/` row
  (`client-config.md` — `kerghan configure` / `kerghan wizard` reference).
- `.claude/agents/standalone.md`, "References": add `docs/agents/standalone/client-config.md`
  as the reference for `configure` / `wizard`, to keep up to date together with the client.

## Files to Change
- `README.md` — configuration section pointer and full key list.
- `standalone/config.example` — header pointer to the commands.
- `docs/agents/environment-variables.md` — `kerghan configure` pointer.
- `docs/agents/folder-structure.md` — new sub-doc listed.
- `.claude/agents/standalone.md` — reference to the new sub-doc.
