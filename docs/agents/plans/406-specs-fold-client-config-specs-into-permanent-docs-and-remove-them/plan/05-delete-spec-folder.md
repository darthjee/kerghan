# Delete the spec folder and complete the spec entry

- Delete `docs/agents/specs/client-config/` (all five files).
- In `docs/agents/specs.md`, remove the row from "Active specs" so it reads "none", and add a
  row to "Completed specs": "Client config (`kerghan configure` / `kerghan wizard`)" → now
  defined in [standalone/client-config.md](standalone/client-config.md) (and
  [standalone.md](standalone.md)), product decision #402.
- Run `grep -rn "specs/client-config" .` (excluding `docs/agents/issues/` and
  `docs/agents/plans/`) and confirm it finds nothing.

## Files to Change
- `docs/agents/specs/client-config/` — deleted.
- `docs/agents/specs.md` — entry moved to "Completed specs".
