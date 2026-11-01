# Update standalone.md and folder-structure.md
In `docs/agents/standalone.md`:
- "Upgrading": make `kerghan update [VERSION]` the way to upgrade (client and image move together, restart governed by `restart-on-update` / `--restart` / `--no-restart`), keep the manual installer + `kerghan up` path for clients older than `FIRST_UPDATE_VERSION` (0.8.2 and older), and reword "Downgrades are not supported" to match what shipped (see the plan's Notes).
- "The `kerghan` client": add `update` to the command list, and add a short "`update`" sub-section (like the existing "`configure` and `wizard`" one) linking to `standalone/client-update.md`.
- "`config` format": make sure `restart-on-update` is listed (values `ask | always | never`, default `ask`).
- Mention in the `configure` and `wizard` summary that they handle `restart-on-update`, if #416 did not already.

In `docs/agents/folder-structure.md`, extend the `standalone/` sub-docs row: `client-config.md` and `client-update.md` (`kerghan update` / `restart-on-update` reference).

## Files to Change
- `docs/agents/standalone.md` — upgrade flow, command list, `update` summary, config key
- `docs/agents/folder-structure.md` — list the new sub-doc
