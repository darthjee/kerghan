# Stable contracts

Part of [Standalone: client update](../client-update.md). These interfaces span client versions, the installer and GitHub release assets. Once shipped, contracts here can only grow in backward-compatible ways: updates are initiated by one version and completed by another, while a downgrade may run code already released and immutable.

## Handoff interface

After the installer replaces the client, the old client executes:

```text
exec "<real install dir>/kerghan" update --finish
```

The install directory is the absolute real directory of the executing client, also passed as `KERGHAN_INSTALL_DIR`. The target is exact, never a PATH lookup. `--finish` is the only argument; all context is environment, allowing older clients to ignore unknown optional variables. Staging is removed before exec.

| Variable | Meaning | Unset/invalid behavior |
|----------|---------|-----------------------|
| `KERGHAN_UPDATE_FROM` | Old client's `KERGHAN_VERSION` | Finish still runs; no origin in result and no downgrade inferred. |
| `KERGHAN_UPDATE_RESTART` | `always` or `never`, only for explicit restart flags and never on downgrade | Read config setting; empty counts as unset. |

The old client explicitly sets or unsets both values, preventing exported shell variables from leaking into handoff. The new client uses `KERGHAN_UPDATE_FROM` only if it matches `[A-Za-z0-9._-]{1,64}`; downgrade detection additionally requires strict `x.y.z` newer than the new client. Invalid restart values other than `always`/`never` are ignored with a warning. Previous image is not passed; the new client reads it from the running container.

### Backward-compatibility rules

1. Every later client continues accepting hidden `update --finish`; it cannot be removed or renamed.
2. Missing variables fall back to defaults; unknown variables are ignored.
3. New context is added only through new optional variables with backward-compatible defaults; existing meanings never change.
4. Every client with `update --finish` skips restart when valid `KERGHAN_UPDATE_FROM` is newer than its own version. This is how downgrade targets avoid reopening data, and cannot be dropped. Downgrade is not signaled through `KERGHAN_UPDATE_RESTART`.

Run `update --finish` by hand only to run finish steps for the installed version; it does no download or install. `--finish` must be the sole argument; any accompanying argument is usage error exit `2`.

## Installer interface

The old client runs:

```text
KERGHAN_VERSION=<target> KERGHAN_INSTALL_DIR=<real install dir> "$BASH" <staging>/install.sh
```

It relies only on the already-shipped installer behavior:

- `KERGHAN_VERSION` selects client version; `KERGHAN_INSTALL_DIR` selects its destination. Both are explicitly passed, overriding exported values.
- A stamp line `KERGHAN_VERSION="x.y.z"` at start of line carries release version. `scripts/bump_version.sh` and the installer header must preserve this format.
- Installer never prompts or uses sudo; requires reachable Docker and writable target; stages download and uses final `mv -f` as its only install-directory write; installs Vault only when missing; exits nonzero for client/Vault install failures. Bash completion failures only warn.
- `update` does not pass `KERGHAN_COMPLETION`; completion runs on update unless caller exported `KERGHAN_COMPLETION=false`.
- Installed filename is always `kerghan`; update refuses clients whose real filename differs.

No installer addition is needed: the installer stamp supplies the target; a downgrade runs an older immutable installer; env/pull/restart belong to the new client. Future installer additions are optional and additive, never required for downgrade. The bash completion installer step is not relied on and is non-fatal.

## Release assets

Every release publishes `install.sh` and the matching `kerghan` client as assets at both version-specific and `releases/latest/download` URLs. Release tags are plain `x.y.z`, without `v`. The latest release must be the highest published version; the client asset is published only after its pinned image exists. These rules ensure the handoff can pull the image it needs.

## First upgrade

Versions older than `FIRST_UPDATE_VERSION` (`0.8.3`; 0.8.2 and earlier) do not have `update`. Moving to the first update-capable version requires running the installer manually once, then `kerghan up`, as documented in the root README and [Standalone Distribution](../install.md#upgrading).

## Required contract tests

In `standalone/test/update.bats` and `install.bats`:

- Handoff targets the real install directory with exactly `update --finish`, including symlinked invocation and PATH shadowing.
- Handoff variables are correct for `--restart`, `--no-restart`, and neither, even when caller exports conflicting values; staging is gone when the new client starts.
- Hand-run finish fallbacks cover missing/invalid/empty variables, ignored unknown variables, and argument errors; newer origin skips restart.
- Installer receives explicit target and real install directory despite caller environment; stamped installer version matches client version.
