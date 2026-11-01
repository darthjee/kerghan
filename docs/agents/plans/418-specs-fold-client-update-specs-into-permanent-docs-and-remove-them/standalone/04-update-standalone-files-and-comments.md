# Update standalone/ files and comment links
- `standalone/install.sh` header comment: document as a stable contract that `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR` are the interface `kerghan update` drives, and that the `KERGHAN_VERSION="x.y.z"` stamp line at the start of a line carries the release version (written by `scripts/bump_version.sh`, read by `kerghan update`); point at `docs/agents/standalone/client-update.md#stable-contracts`. No code change.
- `standalone/config.example`: check the `restart-on-update` block added by #416 matches the doc and links (if at all) to the new sub-doc.
- `standalone/bin/kerghan` and `standalone/test/*.bats`: replace every reference to `docs/agents/specs/client-update/...` with the matching anchor in `docs/agents/standalone/client-update.md`. Comment-only changes.

## Files to Change
- `standalone/install.sh` — header comment only
- `standalone/config.example` — comment check/fix
- `standalone/bin/kerghan` — comment links only
- `standalone/test/*.bats` (e.g. the update and setting suites added by #416/#417) — comment links only
