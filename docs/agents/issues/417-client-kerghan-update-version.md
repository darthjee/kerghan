# Issue: Client: `kerghan update [VERSION]`

## Description

Third sub-issue of the client update Epic (#414). Implement `kerghan update [VERSION]` and its hidden `update --finish` step in the `kerghan` client, exactly as defined by the specs in `docs/agents/specs/client-update/` (#415, merged): [command.md](../specs/client-update/command.md), [versions.md](../specs/client-update/versions.md), [contracts.md](../specs/client-update/contracts.md) and [security.md](../specs/client-update/security.md). The `restart-on-update` setting it reads already shipped with #416.

The specs are the source of truth for every message, exit code and stream. In short:

0. **Preconditions** (old client, before any download): `load_config`; resolve the real path of the running client (symlinks resolved, file must be named `kerghan`); refuse when its directory is not writable.
1. **Resolve:** validate `VERSION` (strict `x.y.z`, one leading `v` stripped, exit `2` otherwise). Download the release's `install.sh` (`releases/latest/download/` or `releases/download/<v>/`) once, into a `mktemp -d` staging folder, and read the version from its `KERGHAN_VERSION="x.y.z"` stamp line (read as text, never sourced). 404 / network / missing or mismatched stamp each fail with exit `1` and nothing changed.
2. **Compare** with `version_compare`: no-op (`already up to date`, one `curl` call, no Docker), `--force` reinstall, "newer than the latest release", non-release client (warn, no comparison), upgrade, or downgrade (explicit `VERSION` only: four warning lines, `[y/N]` prompt, `--yes` required without a TTY, declined exits `1`).
3. **Install:** run the downloaded file with `"$BASH" <file>` and `KERGHAN_VERSION=<target>` / `KERGHAN_INSTALL_DIR=<real dir of the running client>`. No installer change is needed.
4. **Hand off:** remove the staging folder, check the new file is a regular executable, set `shopt -s execfail`, then `exec "<install dir>/kerghan" update --finish` with `KERGHAN_UPDATE_FROM` always set and `KERGHAN_UPDATE_RESTART` set to the `--restart` / `--no-restart` override or explicitly unset. Skipped when the target is older than `FIRST_UPDATE_VERSION` (the client is replaced, `kerghan client replaced: X -> Y` plus the instance-state hint, exit `0`).
5. **Finish** (new client): `load_config`; add missing `kerghan.env` keys through a helper extracted from `cmd_update_env` (e.g. `add_missing_env_keys`, `update-env`'s own output unchanged); read the previous running image; warn about an `image-tag` override; `docker pull` the image `up` would run (variant from config); restart decision per the spec table (downgrade / missing env with data volume / stopped / equal image / `KERGHAN_UPDATE_RESTART` / `restart-on-update` with `ask` prompting only on a TTY), running `cmd_up` in an errexit-preserving subshell; then the result line and the `docker image rm` cleanup hint.

`FIRST_UPDATE_VERSION` is hardcoded to `0.8.3`, with no pre-release check. Any value above `0.8.2` (the newest release without `update`) and no higher than the release that actually ships `update` behaves the same, because no release exists in between. So `0.8.3` stays correct even if that release ends up being numbered `0.9.0`. A short comment next to the constant records this.

`update --finish` stays hidden from `usage` and must be the only argument. The `usage` text gains the `update` synopsis and the `Options for update:` block verbatim from command.md, and the header comment listing the commands that load the config adds `update`.

### Scope

In scope: `standalone/bin/kerghan` (the command, `update --finish`, the extracted env helper, the dispatcher entry, `usage`, `FIRST_UPDATE_VERSION`) and a new `standalone/test/update.bats` covering every "Required tests" section of the client-update specs, with `curl`, the installer, `vault` and `docker` stubbed and the TTY driven through `KERGHAN_ASSUME_TTY=true`.

Out of scope (per the specs): checksum/signature verification, updating `vault`, automatic update checks, image pruning, rollback of any kind, concurrent runs, and any installer behaviour change. Folding the specs into the permanent docs (including the "first upgrade is still manual" note) is #418.

## Problem

The client has no update command. Upgrading means re-running the installer by hand and then `kerghan up`, and there is no supported way to move to a specific version.

## Expected Behavior

- `kerghan update` moves the client and image to the latest release; `kerghan update 0.9.0` (or `v0.9.0`) moves them to that version.
- The no-op, `--force`, "newer than the latest release", the non-release client, the downgrade warning/confirmation and `--yes`, and `--restart` / `--no-restart` behave as specified in versions.md and command.md.
- Every edge case of #414 (invalid or missing version, no network, an `image-tag` override, the offline variant, a stopped instance, a non-release running image, a failed restart or pull, a non-writable install dir, a symlinked client, Docker unreachable) behaves as the specs describe, with their exact messages and exit codes.
- `kerghan update-env` keeps its exact current output.
- `kerghan.env` values are never printed, nothing runs with sudo, and no credentials are used.
- `update.bats` covers all the specs' required tests.
