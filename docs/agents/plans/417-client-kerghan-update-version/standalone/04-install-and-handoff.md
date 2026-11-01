# Install and hand off (old client)

Implement steps 3–4 of command.md's flow.

**Install:** run `KERGHAN_VERSION=<target> KERGHAN_INSTALL_DIR=<real dir> "$BASH"
<staging>/install.sh`, both variables always passed explicitly (an exported value in the user's
shell never applies). Its output passes through unchanged. Non-zero → `the installer failed;
kerghan <current> is still installed`, exit 1 (this also covers Docker unreachable via the
installer's `check_docker`).

**Below `FIRST_UPDATE_VERSION`** (target older than it, i.e. a downgrade to ≤0.8.2): skip the
handoff; print `kerghan client replaced: X -> Y` on stdout, then the downgrade instance-state
hint (running → `down && up` switch hint; not running → `up` start hint, checked with
`running_image`), exit 0. The `EXIT` trap removes the staging folder.

**Hand off:** remove the staging folder explicitly and clear the trap (an `exec` runs no trap);
check `<dir>/kerghan` is `-f` and `-x`; `shopt -s execfail`; then
`KERGHAN_UPDATE_FROM=<current> exec "<dir>/kerghan" update --finish`, with
`KERGHAN_UPDATE_RESTART` set to `always`/`never` for `--restart`/`--no-restart` and explicitly
`unset` otherwise (`--restart` is not passed on a downgrade). If the check or the `exec` fails →
`could not run <dir>/kerghan update --finish` + `kerghan version` / `kerghan up` hint, exit 1.
The path is always absolute, never a `PATH` lookup, and nothing uses sudo.

## Files to Change
- `standalone/bin/kerghan` — install, below-first-version and handoff parts of `cmd_update`.
