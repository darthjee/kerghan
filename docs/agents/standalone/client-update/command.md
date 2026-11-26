# Command and update flow

Part of [Standalone: client update](../client-update.md). This page specifies `kerghan update [VERSION]`, its arguments and its old-client/new-client execution flow. Version comparison details are in [versions and downgrades](versions.md); restart policy is in [restart configuration](restart.md).

## Purpose and scope

`kerghan update` updates the installed client and the standalone image together. Without it, users rerun `install.sh` and then `kerghan up` to recreate a running container on the image pinned by the new client. The command performs resolution, comparison, installation, handoff, environment update, image pull, optional restart and result reporting.

It does not check for updates in the background, update Vault when already installed, verify checksums/signatures, prune old images automatically, roll back failures, or coordinate concurrent runs. It does not change `install.sh`; see [stable contracts](contracts.md).

## Usage and options

The command appears before `update-env` in `kerghan help`:

```text
  update [VERSION] [--force] [--yes] [--[no-]restart]
                                  update the client and the image to VERSION (default: the latest release)
```

Its options block follows `Options for up:`:

```text
Options for update:
  VERSION            release to install, x.y.z (default: the latest release)
  --force            reinstall even when already on that version
  --yes              confirm a downgrade without asking
  --restart          restart a running instance afterwards (overrides restart-on-update)
  --no-restart       leave a running instance as it is (overrides restart-on-update)
```

`update --finish` is hidden and never listed. `update` is a distinct dispatcher entry from `update-env`; dispatch uses exact command matching, not prefixes.

| Argument | Effect |
|----------|--------|
| `VERSION` | Optional target version; see [validation and resolution](versions.md). |
| `--force` | Reinstall only when already at the target version; never skips downgrade confirmation. |
| `--yes` | Confirms a downgrade without prompting. Does not imply restart. |
| `--restart` | Requests restart after update, overriding configuration; ignored with a warning on downgrade. |
| `--no-restart` | Prevents restart after update, overriding configuration. |

Options and the version may be in any order. Parsing happens before config loading or network access. Usage errors exit `2` and print usage:

- More than one positional version: `kerghan: error: only one VERSION can be given`.
- Both restart flags: `kerghan: error: options '--restart' and '--no-restart' cannot be combined`.
- `--finish` with any other argument, before or after it: `kerghan: error: option '--finish' must be the only argument`.
- Unknown option: `kerghan: error: unknown option '<option>'`.

## Update flow

The old client performs preconditions, resolution, comparison, installation and handoff. The new client performs finish steps.

### Preconditions

Before downloading, the old client loads and validates config, resolves the real path of its own executable, requires the real filename to be `kerghan`, and checks that its install directory is writable. Broken config, unresolved paths, a differently named client, or an unwritable directory fail with exit `1` before download. `update` never uses sudo. A downgrade can be blocked if the old client rejects a newer config value; users may need to fix that config line first.

### Resolve, compare and install

The old client downloads the release installer to a private staging directory and reads its version stamp as text. It compares the resolved version with its own; no-op, newer-than-latest, non-release and downgrade behavior is in [versions and downgrades](versions.md).

For an update in progress, stdout reports one of:

```text
Updating kerghan 0.9.0 -> 0.9.1...
Reinstalling kerghan 0.9.1...
Downgrading kerghan 0.9.2 -> 0.9.0...
```

The downloaded installer is run as `"$BASH" <staging>/install.sh`, with explicit `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR` values. Installer output passes through unchanged. On installer failure, its final atomic replacement has not occurred; the old client reports that it is still installed and exits `1`.

### Handoff

After installation, the old client removes its staging directory and executes exactly `<real install dir>/kerghan update --finish`; it does not search `PATH`. It checks that the new file exists and is executable and enables `execfail` so an exec error can be reported. An exec failure may occur after replacement; the error advises checking `kerghan version` and running `kerghan up`. Downgrades below `FIRST_UPDATE_VERSION` skip the handoff entirely.

The handoff environment and compatibility rules are in [stable contracts](contracts.md#handoff-interface).

### Finish in the new client

`update --finish` runs, in order:

1. Load and validate config.
2. Add missing `kerghan.env` keys using `update-env` rules: preserve existing values, write atomically, keep mode `600`, and never print values. If the file is absent with an existing data volume, warn and skip restart; if absent without a volume, skip silently.
3. Read the running container image before changes.
4. Warn if configured `image-tag` overrides the pinned tag.
5. Pull the image `up` would use (config/default variant and `image-tag` override). The existing instance stays running during the foreground pull. Pull failure exits `1`, leaves the client updated, and prints recovery instructions; there is no rollback.
6. Decide whether to restart. See [restart configuration](restart.md#restart-decision).
7. Print the result and, if appropriate, the old-image cleanup hint.

A restart reuses plain `kerghan up` logic and its config/defaults, preserving the data volume. Flags passed to an earlier `kerghan up` are not remembered. `cmd_up` is run in a subshell with errexit restored inside it; comparing container IDs determines whether the container was recreated. A restart failure prints `up`'s errors/hints plus an update restart failure message and returns the restart's status.

## Result and image cleanup

After a successful finish, stdout reports `kerghan updated <old> -> <new>`, `kerghan <new> reinstalled`, or `kerghan <new> is installed` (for hand-run finish without valid origin metadata). If a known previous image differs from the pulled image, stderr suggests `docker image rm <old-image>` after a restart, or after `kerghan up` when the instance remains on the old image. There is no automatic pruning. Downgrades use their manual-switch hint instead; see [versions](versions.md#downgrade).

Stopped instances are never started. A running non-release image follows `up`'s warn-and-recreate behavior. A matching image/settings pair is left running.

## Example

```text
$ kerghan update
Updating kerghan 0.9.0 -> 0.9.1...
kerghan-install: downloading kerghan 0.9.1
kerghan-install: kerghan 0.9.1 installed to /home/me/.local/bin/kerghan
0.9.1-offline: Pulling from darthjee/kerghan-standalone
...
Restart Kerghan now? [Y/n]
upgrading darthjee/kerghan-standalone:0.9.0-offline -> darthjee/kerghan-standalone:0.9.1-offline
...
Kerghan is running at http://127.0.0.1:3000
kerghan updated 0.9.0 -> 0.9.1
kerghan: hint: free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0-offline'
```
