# Remove the specs and mark them completed
- Delete `docs/agents/specs/client-update/` (all six files).
- In `docs/agents/specs.md`: the "Active specs" table becomes the line "none" (keep the "When no feature is in progress…" convention), and add a row to "Completed specs":
  `| Client update (`kerghan update` / `restart-on-update`) | [standalone/client-update.md](standalone/client-update.md) (command, versions, setting, security, stable contracts, required tests); [standalone.md](standalone.md) (command list, upgrading, `update` summary); `README.md` "Run Kerghan standalone" (upgrade, first upgrade); `standalone/install.sh` header (installer interface); `standalone/config.example` | #414 |`

## Files to Change
- `docs/agents/specs/client-update/` — deleted
- `docs/agents/specs.md` — Active → none, new Completed row
