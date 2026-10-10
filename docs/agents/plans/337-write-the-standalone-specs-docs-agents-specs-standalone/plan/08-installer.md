# Write installer.md

Create `docs/agents/specs/standalone/installer.md`:

- One-liner: `curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash`.
- Behavior: checks Docker is installed and reachable; never uses `sudo`; installs `kerghan` to
  `~/.local/bin` (warns with the `PATH` line if missing); `KERGHAN_VERSION` pins, `KERGHAN_INSTALL_DIR`
  relocates; rerunning upgrades in place; installs the `vault` CLI when missing via Vault's own
  `install.sh` with `VAULT_VERSION` pinned to the standalone image's Vault base (`0.1.0`).
- Errors (exit 1): Docker missing/unreachable, install dir not writable, download failure,
  unsupported OS.
- Release assets per semver tag (CircleCI, `gh release upload`, after the standalone release):
  `kerghan` (version pinned inside), `install.sh`, `kerghan.env.example`, `SHA256SUMS`; how to
  verify with `sha256sum -c` / `shasum -a 256 -c`.
- **Required tests:** each error path; install into a custom dir; Vault installed only when missing
  and with the pinned version; rerun upgrades; `SHA256SUMS` matches the uploaded files.

## Files to Change
- `docs/agents/specs/standalone/installer.md` — new.
