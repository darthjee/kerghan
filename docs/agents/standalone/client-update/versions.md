# Versions and downgrades

Part of [Standalone: client update](../client-update.md). This page defines target version validation, installer-stamp resolution and comparison behavior, including the downgrade confirmation and the first version that supports the update handoff.

## Version validation

`VERSION` is optional. When provided, it must be strict `x.y.z` semver (three dot-separated digit runs, following `is_semver`). One leading `v` is stripped, so `v0.9.0` means `0.9.0`. Values such as `latest`, `0.9`, `0.9.0-rc1`, `vv0.9.0`, `../0.9.0`, `0.9.0?x`, whitespace and newlines are usage errors before any download:

```text
kerghan: error: invalid version 'latest' (expected x.y.z, e.g. 0.9.0)
```

The value enters a URL and installer environment, so only digits and dots may pass validation. See [security](security.md#strict-version).

## Resolve through the installer stamp

The target is read from the downloaded release's `install.sh`, whose stamp is maintained by `scripts/bump_version.sh`:

```text
KERGHAN_VERSION="0.9.1"
```

| Request | Installer URL |
|---------|---------------|
| No version | `https://github.com/darthjee/kerghan/releases/latest/download/install.sh` |
| Explicit version | `https://github.com/darthjee/kerghan/releases/download/<VERSION>/install.sh` |

The installer is downloaded once to the staging directory and the same file is run. The first matching `^KERGHAN_VERSION="[0-9]+\.[0-9]+\.[0-9]+"$` line is read as text; it is never sourced or evaluated. The HTTP status from curl distinguishes 404 from network failures without a second request.

Every resolution failure exits `1`, removes staging files and changes nothing:

| Failure | Result |
|---------|--------|
| Explicit version returns HTTP 404 | `version <v> does not exist`, with a link to available releases |
| Latest URL returns HTTP 404 | `no release found at <url>` |
| Network, DNS, TLS, timeout or other HTTP failure | `could not download <url>`, with a network hint |
| Empty installer or no valid stamp | `has no KERGHAN_VERSION="x.y.z" line; nothing was changed` |
| Stamp differs from explicit version | Reports both versions and says nothing was changed |

## Comparison outcomes

The old client compares the target with its own `KERGHAN_VERSION` using `version_compare`; comparison does not call Docker.

| Case | Outcome |
|------|---------|
| Target equals current version | No-op; stdout: `kerghan <v> is already up to date.`, exit `0`. No install, handoff or Docker call. |
| Same version with `--force` | Reinstall through the full flow. |
| No version supplied and latest release is older | Report that the installed client is newer than latest; print a hint for explicit downgrade; exit `0`, no install. `--force` does not change this. |
| Target newer | Full upgrade. |
| Explicit target older | Downgrade warning and confirmation. |
| Current client version is not semver | Warn that it is not a release, then update without comparison or confirmation. |

The no-op accepts `--yes`, `--restart` and `--no-restart` with no effect. A non-release client likewise needs no `--force` or confirmation.

## Downgrade

Only an explicit older `VERSION` requests a downgrade. Immediately after resolution, stderr receives four warnings, including that older versions may contain fixed security issues, newer config keys may be ignored, and the instance will not restart automatically. Then:

| Situation | Behavior |
|-----------|----------|
| `--yes` | Continue without prompting. |
| TTY, no `--yes` | Prompt `Downgrade to <v>? [y/N] ` on stderr; `y` or `yes` (case-insensitive) continues. Other input, Enter and EOF print `Downgrade cancelled; nothing was changed.` and exit `1`. |
| No TTY, no `--yes` | Refuse with an error and hint to use `kerghan update <v> --yes`; exit `1`. |

`--force` never bypasses this confirmation. `--yes` on an upgrade or no-op has no effect.

The MySQL 8.4.11 release migrated from MySQL 9.3.0 during restart and removes old data after verification. Downgrading below that release is unsupported: the older compose may start MySQL 9.3 on a missing volume, producing an empty database. The downgrade hint calls out this risk.

### Why a downgrade never restarts

`kerghan up` refuses to recreate a running instance on an older image because older versions may not read data written by newer versions. The update finish step reuses that logic. It installs the older client and (if supported) hands off and pulls the target image, but never restarts, regardless of `restart-on-update` or restart flags. `--restart` adds a warning that it is ignored and is not passed to the new client.

For a running instance, the user is told to run `kerghan down && kerghan up` to switch manually, with a warning that the older version may not read newer data. For a stopped instance, the hint is `kerghan up` to start it on the target version. A handoff downgrade prints the result line before this state hint and never prints an old-image cleanup hint.

### Below `FIRST_UPDATE_VERSION`

`FIRST_UPDATE_VERSION` is `0.8.3`, the first release containing `update`; it must never change. A downgrade to a client older than that release is allowed after the same warning and confirmation. The old client runs the installer, skips `exec`, env update, pull and restart, prints `kerghan client replaced: <old> -> <target>`, then the instance-state hint, and exits `0`.

## Required version tests

In `standalone/test/update.bats`:

- Accept `0.9.0` and `v0.9.0`; reject invalid forms (including metacharacters/newlines) with exit `2` before curl.
- Exercise latest and explicit URLs; 404, network, empty file, missing/malformed/mismatched stamp failures; confirm exit `1`, unchanged client, removed staging directory.
- Verify no-op uses one curl and no Docker/installer; `--force` installs. Verify newer-than-latest does not install, even with `--force`.
- Verify non-release warning and full update without confirmation.
- Cover downgrade confirmation on TTY yes/no/Enter/EOF and no-TTY with/without `--yes`; verify warning lines and that `--force` alone still asks.
- Verify no downgrade restart under `always` or `--restart`, ignored-flag warning and running/stopped hints.
- Verify below-first-version downgrade replaces client only and skips handoff and Docker pull.
