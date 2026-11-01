# Write the client-update sub-doc
Create `docs/agents/standalone/client-update.md`, titled "Standalone: client update (`kerghan update` / `restart-on-update`)", modelled on `client-config.md` (intro linking back to `standalone.md`, then sections by concern). Fold every spec file, checking each rule against the shipped `standalone/bin/kerghan`:

- **Overview and scope** (from `README.md`): what `update` does, in/out of scope, behaviour decisions, "Alternatives rejected".
- **Exit codes and streams** (from `README.md`).
- **`kerghan update [VERSION]`** (from `command.md`): usage, options, the flow (preconditions → resolve → compare → install → hand off → finish), restart decision, result and cleanup hints, instance state, example, required tests.
- **Versions** (from `versions.md`): `VERSION` validation, resolution through the installer stamp line, comparison (no-op, `--force`, newer than latest, non-release client), downgrade and why it never restarts, `FIRST_UPDATE_VERSION`, required tests.
- **`restart-on-update`** (from `setting.md`): key and values, parser, `configure` and its apply hint, `wizard` question, usage and `config.example` lines, older clients, required tests.
- **Security** (from `security.md`): trust model, download to a file, temp files, strict `VERSION`, exact-path execution, no sudo or credentials, secrets, downgrade risk, required tests.
- **Stable contracts** (from `contracts.md`), opened by a short paragraph saying these can only grow in backward-compatible ways because every update runs code from two versions: handoff interface (`exec "<install dir>/kerghan" update --finish`, its environment and rules, running `--finish` by hand), installer interface (`KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR`, the stamp line `scripts/bump_version.sh` must keep writing, behaviour guarantees, why no installer addition is needed), release files, first upgrade, required tests.

Rewrite every internal link (`command.md#...`, `security.md#...`, etc.) to an anchor inside the new file. Drop the sub-issue map, "Built by #41x" lines and ordering notes.

## Files to Change
- `docs/agents/standalone/client-update.md` — new permanent sub-doc
