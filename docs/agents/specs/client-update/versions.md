# Versions: validation, resolution and comparison

How `kerghan update` picks the target version and decides what to do with it. All of this runs
in the **old** (currently installed) client, before anything is changed. Built by #417.
Overview: [README.md](README.md); the full flow: [command.md](command.md#flow).

## `VERSION` validation

`VERSION` is optional. When given, it must be strict `x.y.z` semver (three dot-separated runs of
digits, the client's existing `is_semver` rule). A single leading `v` is stripped first, so
`v0.9.0` means `0.9.0`.

Anything else (`latest`, `0.9`, `0.9.0-rc1`, `../0.9.0`, `0.9.0?x`, a value with spaces) is a
usage error, checked before any download:

```
kerghan: error: invalid version 'latest' (expected x.y.z, e.g. 0.9.0)
```

followed by the usage, exit `2`. The value goes into a URL and into an environment variable, so
nothing but digits and dots may reach either (see [security.md](security.md#strict-version)).

## Resolution through the installer stamp line

The target version is read from the release's own `install.sh`, which carries it in its stamp
line, rewritten by `scripts/bump_version.sh` on every release:

```
KERGHAN_VERSION="0.9.1"
```

| Given | Downloaded |
|-------|------------|
| No `VERSION` | `https://github.com/darthjee/kerghan/releases/latest/download/install.sh` |
| `VERSION` | `https://github.com/darthjee/kerghan/releases/download/<VERSION>/install.sh` |

- **One download.** The file is saved into the staging folder (see
  [security.md](security.md#download-to-a-file)) and is the same file the install step runs (see
  [command.md](command.md#3-install)). Resolution, the existence check and the install cost one
  HTTP request; no GitHub API, no credentials.
- **Reading the stamp:** the first line matching `^KERGHAN_VERSION="[0-9]+\.[0-9]+\.[0-9]+"$`.
  The file is only read as text, never sourced or evaluated to find the version.

Every failure below exits `1`, removes the staging folder and changes nothing:

| Case | Message |
|------|---------|
| `VERSION` given, HTTP 404 (the version does not exist) | `kerghan: error: version 0.9.7 does not exist` + `kerghan: hint: see https://github.com/darthjee/kerghan/releases for the available versions` |
| No `VERSION`, HTTP 404 (no release published) | `kerghan: error: no release found at <url>` |
| Any other download failure (no network, DNS, TLS, timeout, other HTTP error) | `kerghan: error: could not download <url>` + `kerghan: hint: check your network connection and that github.com is reachable, then try again` |
| Empty file, or no valid stamp line | `kerghan: error: <url> has no KERGHAN_VERSION="x.y.z" line; nothing was changed` |
| Stamp differs from the requested `VERSION` | `kerghan: error: <url> is for version 0.9.0, not 0.9.1; nothing was changed` |

The HTTP status comes from `curl` itself (e.g. `-w '%{http_code}'`), so a 404 is told apart from
a network failure without a second request.

## Comparison

The resolved target is compared with the running client's own `KERGHAN_VERSION` using the
client's existing `version_compare`. The comparison never touches Docker.

| Case | Result |
|------|--------|
| Target equal to the current version (no `VERSION`, or the same `VERSION`) | No-op, see [Already up to date](#already-up-to-date) |
| Same, with `--force` | Reinstall: the full flow runs, as an upgrade would |
| No `VERSION` and the latest release is **older** than the current version | See [Newer than the latest release](#newer-than-the-latest-release) |
| Target newer | Upgrade: the full flow runs |
| Explicit `VERSION` older | [Downgrade](#downgrade) |
| Current `KERGHAN_VERSION` is not `x.y.z` | See [Non-release client](#non-release-client) |

### Already up to date

```
kerghan 0.9.1 is already up to date.
```

on stdout, exit `0`. Nothing else runs: no install, no handoff, no Docker call. `--yes`,
`--restart` and `--no-restart` are accepted and have no effect.

### Newer than the latest release

A plain `kerghan update` whose latest release is older than the current client (a release was
withdrawn, or this is a newer local build that happens to be semver):

```
kerghan 0.9.2 is newer than the latest release 0.9.1; nothing to do.
kerghan: hint: run 'kerghan update 0.9.1' to downgrade to it
```

The first line on stdout, the hint on stderr, exit `0`. A downgrade only ever happens with an
explicit `VERSION`; `--force` does not turn this case into one.

### Non-release client

When the current `KERGHAN_VERSION` is not `x.y.z` (a development build), no comparison is
possible. The client warns and then runs the full flow to the target, without the no-op and
without the downgrade logic, the same idea as `kerghan up`'s handling of a non-release image:

```
kerghan: warning: this client (dev) is not a release; updating to 0.9.1 without comparing versions
```

`--force` is not needed, and no confirmation is asked.

## Downgrade

An explicit `VERSION` older than the current client. Before anything else runs (right after
resolution), the client prints the warning on stderr:

```
kerghan: warning: downgrading kerghan 0.9.2 -> 0.9.0
kerghan: warning: older versions may have security issues that later releases fixed
kerghan: warning: config keys added after 0.9.0 are reported as unknown (and ignored) by it
kerghan: warning: the instance is not restarted on a downgrade: switch it by hand afterwards
```

then confirms:

| Situation | Behaviour |
|-----------|-----------|
| `--yes` | No prompt; the downgrade runs. |
| TTY (`is_tty`), no `--yes` | Prompt `Downgrade to 0.9.0? [y/N] ` on stderr. `y` / `yes` (any case) runs it; anything else, Enter included, prints `Downgrade cancelled; nothing was changed.` on stdout and exits `1`. |
| No TTY, no `--yes` | `kerghan: error: a downgrade needs a confirmation, but stdin is not a terminal` + `kerghan: hint: run 'kerghan update 0.9.0 --yes' to confirm it`, exit `1`. |
| End of input at the prompt | Same as answering no. |

- **`--force` does not change this:** it only affects the same-version case.
- **`--yes` on an upgrade or a no-op** is accepted with no effect.

### Why a downgrade never restarts

`kerghan up` refuses to recreate a running instance on an image older than the one it runs
(`recreate_reason`: "downgrades are unsupported"), because an older image may not read data a
newer one wrote. The finish step reuses `up`'s logic, so restarting after a downgrade would
always fail. Instead, a downgrade:

- installs the older client and, when the target ships `update`, runs the handoff with its env
  step and pull as usual;
- never restarts, whatever `restart-on-update`, `--restart` or `--no-restart` say
  (`--restart` prints `kerghan: warning: --restart is ignored on a downgrade`);
- ends with the hint for the instance state (the new client knows the running image; the old
  client below `FIRST_UPDATE_VERSION` checks it itself):

| Instance | Hint |
|----------|------|
| Running | `kerghan: hint: run 'kerghan down && kerghan up' to switch the instance to 0.9.0 (an older version may not read data written by a newer one)` |
| Not running | `kerghan: hint: run 'kerghan up' to start the instance on 0.9.0` |

The new (older) client recognises the downgrade from the handoff variable `KERGHAN_UPDATE_FROM`
being newer than its own version (see [contracts.md](contracts.md#handoff-interface)).

### Downgrade below `FIRST_UPDATE_VERSION`

`FIRST_UPDATE_VERSION` is a constant in the client: **the first release that contains
`update`**. These specs do not fix its number; #417 sets it, and a pre-release check (in #417 or
at the version bump) confirms it matches the release that ships `update`.

A client older than `FIRST_UPDATE_VERSION` has no `update --finish`, so the handoff cannot run.
Such a downgrade is allowed:

- the same warning and confirmation (or `--yes`) apply;
- the old client runs the installer as usual, which replaces the client;
- it **skips the handoff**: no `exec`, no env update, no pull, no restart;
- it prints, on stdout, `kerghan client replaced: 0.9.2 -> 0.8.2`, then the hint for the
  instance state from the table above (it checks the running container itself), and exits `0`.

## Required tests

In a new `standalone/test/update.bats`, with `curl` stubbed to serve or fail each URL:

- **Validation:** `0.9.0` and `v0.9.0` accepted; `latest`, `0.9`, `0.9.0-rc1`, `vv0.9.0`,
  `../0.9.0`, `0.9.0?x`, `0.9.0 x` and an empty string rejected with exit `2`, the
  `invalid version` message and no `curl` call.
- **Resolution:** without `VERSION` the `releases/latest/download/install.sh` URL is used, with
  it the `releases/download/<v>/install.sh` URL; a 404 with `VERSION` prints `does not exist`;
  a 404 without it prints `no release found`; a network failure prints `could not download`;
  an empty file, a missing stamp and a malformed one (`KERGHAN_VERSION="0.9"`,
  `KERGHAN_VERSION=0.9.1`) fail; a mismatched stamp fails; in every failure case exit `1`, the
  client file is unchanged and the staging folder is gone.
- **No-op:** same version prints `already up to date`, exit `0`, no installer run and no
  `docker` call; with `--force` the installer runs.
- **Newer than latest:** prints the message and the downgrade hint, exit `0`, no installer run,
  also with `--force`.
- **Non-release client:** the warning is printed and the installer runs without a confirmation.
- **Downgrade matrix:** TTY + `y` runs; TTY + `n`, TTY + Enter and end of input print
  `Downgrade cancelled`, exit `1`, nothing run; no TTY without `--yes` refuses with exit `1`; no
  TTY with `--yes` runs; `--force` without `--yes` still asks; the four warning lines are
  printed in every case.
- **Downgrade, no restart:** with `restart-on-update=always` and with `--restart`, a downgrade
  does not restart; `--restart` prints the `ignored` warning; the running / not running hints
  are printed.
- **Below `FIRST_UPDATE_VERSION`:** the installer runs, no `exec` happens, no `docker pull`, the
  `kerghan client replaced` line and the instance-state hint are printed, exit `0`.
