# Standalone: client update (`kerghan update` / `restart-on-update`)

Part of [Standalone Distribution](../standalone.md). Defines the client command that updates the
standalone client and its image together, the hidden `update --finish` step it hands off to,
the `restart-on-update` setting that decides what happens to a running instance, their security
rules and the **stable contracts** every future release must keep. Product decision: epic #414.
Code: `standalone/bin/kerghan` (`cmd_update`, `cmd_update_finish` and the `update_*` helpers;
`restart-on-update` in the config parser, `configure` and the wizard). Tests:
`standalone/test/update.bats`, plus `config.bats`, `configure.bats`, `configure_files.bats`,
`wizard.bats` and `install.bats`.

- [Overview and scope](#overview-and-scope)
- [Exit codes and streams](#exit-codes-and-streams)
- [`kerghan update [VERSION]`](#kerghan-update-version)
- [Versions](#versions)
- [`restart-on-update`](#restart-on-update)
- [Security](#security)
- [Stable contracts](#stable-contracts)

## Overview and scope

Without `update`, upgrading a standalone installation takes two manual steps: re-run the
installer (`install.sh`, which replaces the client in place), then run `kerghan up`, which sees
that the running container is older than the image the client pins (`KERGHAN_VERSION`) and
recreates it on the new image, keeping the data volume.

`kerghan update [VERSION]` does both in one command:

1. **Resolve** the target version: `VERSION` when given, otherwise the latest release. Both
   come from the release's own `install.sh` (see
   [Resolution through the installer stamp line](#resolution-through-the-installer-stamp-line)).
2. **Compare** it with the running client: a no-op when already there (unless `--force`), and
   a warning plus a confirmation for a downgrade (see [Comparison](#comparison)).
3. **Install** it by running that same downloaded `install.sh` into the directory of the
   running client (see [3. Install](#3-install) and [Installer interface](#installer-interface)).
4. **Hand off** to the new client (`exec <install dir>/kerghan update --finish`), so only the
   new code decides how the new version works (see [Handoff interface](#handoff-interface)).
5. **Finish**, in the new client: add missing `kerghan.env` variables, pull the image, restart
   a running instance according to `restart-on-update` (or `--restart` / `--no-restart`), and
   print the result and the cleanup hint (see [5. Finish](#5-finish)).

The setting `restart-on-update=ask|always|never` (default `ask`) is defined in
[`restart-on-update`](#restart-on-update).

In scope:

- **`kerghan update [VERSION] [--force] [--yes] [--[no-]restart]`**: resolution, comparison,
  install, handoff, env update, pull, restart and hints.
- **The hidden `update --finish` step** and the stable contracts between client versions: the
  handoff, the installer and the release files ([Stable contracts](#stable-contracts)).
- **The `restart-on-update` setting**: parser, `kerghan configure`, `kerghan wizard`, the usage
  text and the `config.example` entry.
- **The trust model and safe execution** of the download and the handoff
  ([Security](#security)).

Out of scope:

- Automatic or background update checks, and "new version available" notices.
- Updating the `vault` CLI: `install.sh` installs it only when it is missing, at its pinned
  `VAULT_VERSION`.
- Checksum or signature verification of the downloads (see [Trust model](#trust-model)).
- Automatic pruning of old images: a hint prints the `docker image rm` command instead.
- Rollback of any kind, and data or schema migration beyond what `kerghan up` already does.
- Concurrent `update` runs.
- Any behaviour change to `install.sh` (see
  [No installer addition is needed](#no-installer-addition-is-needed)).

### Behaviour decisions

- **Client and image always move together.** There is no client-only or image-only mode: the
  client pins its image.
- **Already on the target version:** a no-op that prints `kerghan <v> is already up to date.`;
  `--force` reinstalls anyway.
- **Downgrade:** only with an explicit `VERSION`, after a warning and a `[y/N]` confirmation;
  `--yes` skips the confirmation and is required without a TTY. A downgrade never restarts the
  instance: it prints how to switch it by hand (see [Downgrade](#downgrade)).
- **Downgrade below the first version that ships `update`:** allowed. Only the client is
  replaced; the user switches the instance by hand (see
  [Downgrade below `FIRST_UPDATE_VERSION`](#downgrade-below-first_update_version)).
- **Restart only applies to a running instance.** A stopped instance is never started; a hint
  suggests `kerghan up`.
- **No rollback.** When the pull or the restart fails, the client stays updated and the error
  says how to recover.
- **`image-tag` override kept**, with a warning that it still overrides the pinned version.
- **No installer change.** `update` relies only on the installer contract that already
  shipped (see [No installer addition is needed](#no-installer-addition-is-needed)).

### Alternatives rejected

- **Resolving the latest version through the GitHub API:** rejected; the
  `releases/latest/download/install.sh` redirect needs no API call and no credentials, and the
  same download is reused for the install.
- **Adding a "print the version" mode to `install.sh`:** unnecessary, since the stamp line
  already carries the version, and impossible to rely on for downgrades, which run older
  installers.
- **Refusing downgrades below the first version that ships `update`:** rejected in favour of
  replacing the client and telling the user how to switch the instance.
- **Doing the pull and restart in the old client:** rejected; only the new client knows its
  pinned version, image naming and config keys.
- **Passing the handoff context as arguments:** rejected in favour of environment variables,
  which an older client can ignore without failing (see [Handoff interface](#handoff-interface)).

## Exit codes and streams

Shared by every path, following the client's existing conventions:

| Case | Exit |
|------|------|
| Success, including the no-op, "newer than the latest release" and a skipped restart | `0` |
| Usage error (unknown option, invalid `VERSION`, two `VERSION`s, `--restart` with `--no-restart`, `--finish` with another argument) — prints usage | `2` |
| Failure or refusal (download, stamp, installer, handoff, pull, declined or unconfirmed downgrade) | `1` |
| Restart failure | the exit status of `up`'s restart (non-zero) |
| Ctrl-C | `130` |

A declined downgrade exits `1`, unlike `reset`'s `Aborted.` (exit `0`): it follows the client
config convention for a declined confirmation (`configure --force`), so a script can tell that
no update happened.

Streams:

- **stdout:** progress and result lines (`Updating kerghan …`, `kerghan updated … -> …`), the
  installer's own `kerghan-install:` lines and the `docker pull` progress.
- **stderr:** errors, warnings and hints, through the client's `error` / `warn` / `hint`
  helpers (`kerghan: error: …`, `kerghan: warning: …`, `kerghan: hint: …`); usage errors
  through `usage_error`; and the two prompts (the downgrade confirmation and
  `Restart Kerghan now? [Y/n]`), like the `reset` confirmation.

Exit codes and streams are tested from the "Required tests" of
[`kerghan update`](#required-tests) and [Versions](#required-tests-1).

## `kerghan update [VERSION]`

Updates the installed client and the standalone image together.

### Usage

The `usage` command list has one entry, before `update-env`:

```
  update [VERSION] [--force] [--yes] [--[no-]restart]
                                  update the client and the image to VERSION (default: the latest release)
```

and an options block after `Options for up:`:

```
Options for update:
  VERSION            release to install, x.y.z (default: the latest release)
  --force            reinstall even when already on that version
  --yes              confirm a downgrade without asking
  --restart          restart a running instance afterwards (overrides restart-on-update)
  --no-restart       leave a running instance as it is (overrides restart-on-update)
```

`update --finish` is hidden and never listed (see [`update --finish` by hand](#update---finish-by-hand)).
`update` is a dispatcher entry separate from `update-env`; the dispatcher has no prefix
matching, so neither changes the other.

### Options

| Option | Effect |
|--------|--------|
| `VERSION` | Target version; validated per [`VERSION` validation](#version-validation). |
| `--force` | Reinstall when the target equals the current version. No effect on any other case (it never skips a downgrade confirmation). |
| `--yes` | Confirms a downgrade without a prompt. Accepted with no effect on an upgrade or a no-op. Never implies a restart. |
| `--restart` | Restart a running instance after the update, whatever `restart-on-update` says. Ignored, with a warning, on a downgrade. |
| `--no-restart` | Never restart, whatever `restart-on-update` says. |

Parsing, before anything else runs (exit `2` with the usage on any error):

- Options and `VERSION` may come in any order.
- A second positional argument: `kerghan: error: only one VERSION can be given`.
- `--restart` together with `--no-restart`: `kerghan: error: options '--restart' and '--no-restart' cannot be combined`.
- `--finish` together with any other argument: `kerghan: error: option '--finish' must be the only argument`.
- Any other option: `kerghan: error: unknown option '<option>'`, as in the other commands.

### Flow

Steps 1–4 run in the **old** client, step 5 in the **new** one.

#### 0. Preconditions

Before any download, the old client:

- runs `load_config`, so a broken `~/.kerghan/config` fails now (exit `1`) and not after the
  client was replaced. After a downgrade this also means a value only a newer client accepts
  makes the older client refuse to update until the line is fixed; this is accepted. The
  client's header comment, which lists the commands that load the config, includes `update`;
- resolves the real path of the running client and its directory, and refuses when the file is
  not named `kerghan` or the path cannot be resolved (see
  [Exact-path execution](#exact-path-execution));
- refuses when that directory is not writable, since the installer would fail there anyway:

  ```
  kerghan: error: /home/me/.local/bin is not writable
  kerghan: hint: kerghan update installs to /home/me/.local/bin, where this client runs from; it never uses sudo
  ```

Each refusal exits `1` with nothing changed.

#### 1. Resolve

Download the installer and read its stamp line
([Resolution through the installer stamp line](#resolution-through-the-installer-stamp-line)).

#### 2. Compare

No-op, newer than the latest release, non-release client, upgrade or downgrade with its warning
and confirmation ([Comparison](#comparison)). Then, on stdout:

| Case | Line |
|------|------|
| Upgrade, or a non-release client | `Updating kerghan 0.9.0 -> 0.9.1...` |
| `--force` on the same version | `Reinstalling kerghan 0.9.1...` |
| Downgrade (confirmed) | `Downgrading kerghan 0.9.2 -> 0.9.0...` |

#### 3. Install

Run the downloaded installer with `"$BASH" <file>` and the explicit environment of
[Installer interface](#installer-interface). Its output (`kerghan-install: …` lines, including
its own errors and hints) passes through unchanged. When the client runs through a symlink from
another directory, the installer's `<dir> is not on your PATH` warning may print; it is harmless
and accepted.

When it exits non-zero, nothing was replaced (its only write is the final `mv -f`):

```
kerghan: error: the installer failed; kerghan 0.9.0 is still installed
```

Exit `1`. Docker not reachable is caught here too: the installer's `check_docker` refuses to
run, with nothing changed.

#### 4. Hand off

Remove the staging folder, then `exec` the new client per
[Handoff interface](#handoff-interface). When the target is older than `FIRST_UPDATE_VERSION`,
skip this step and step 5 (see
[Downgrade below `FIRST_UPDATE_VERSION`](#downgrade-below-first_update_version)).

Before the `exec`, the client checks that `<install dir>/kerghan` is a regular, executable file
(`[ -f ] && [ -x ]`) and sets `shopt -s execfail`, so a failed `exec` returns instead of ending
a non-interactive shell with `126` / `127`. When either fails, the client may already be
replaced:

```
kerghan: error: could not run /home/me/.local/bin/kerghan update --finish
kerghan: hint: the client may already be updated: check with 'kerghan version', then run 'kerghan up'
```

Exit `1`.

#### 5. Finish

`kerghan update --finish`, in the new client, in this order:

1. **Config.** `load_config` (the new client's keys and validators).
2. **Env.** Add missing `kerghan.env` variables with the `update-env` rules (missing keys only,
   existing values kept, mode `600`, atomic write, values never printed), through the
   `add_missing_env_keys` helper shared with `cmd_update_env`. It holds the missing-key loop,
   the blank-value warnings, the atomic write and the `Added to <file>: <KEYS>` /
   admin-password lines, and reports whether keys were added through a global
   (`ENV_KEYS_ADDED`, not a subshell). `cmd_update_env` keeps its own output (`is up to date`
   and its apply line). In the finish step:
   - keys added: `Added to <file>: <KEYS>` (and the admin-password line), no apply line;
   - nothing missing: nothing is printed;
   - `kerghan.env` missing and no data volume: skipped silently (`kerghan up` creates it);
   - `kerghan.env` missing and the data volume exists: `kerghan: warning: ~/.kerghan/kerghan.env
     is missing but the data volume vault-kerghan-data exists` plus `update-env`'s restore /
     `kerghan reset` hint; the restart is then skipped (see [Restart decision](#restart-decision)).
3. **Previous image.** Read the running container's image (`running_image`) before anything
   changes it; empty when the instance is not running.
4. **`image-tag` override.** When `image-tag` is set in `config`, warn (the pull and restart
   use the override):

   ```
   kerghan: warning: image-tag=0.8.1 in ~/.kerghan/config still overrides the pinned image tag (0.9.1)
   kerghan: hint: run 'kerghan configure --unset image-tag' to use the pinned image
   ```

5. **Pull** the image `up` would run: `image_ref` with the variant from `config` or the default
   (`variant=offline` pulls the `-offline` image; the running container's variant is never
   used, exactly as with `up`) and the `image-tag` override when set. `docker pull` runs in the
   foreground with its progress shown, while the old container keeps running, so the downtime
   is only the recreate. On failure:

   ```
   kerghan: error: could not pull darthjee/kerghan-standalone:0.9.1; kerghan was updated to 0.9.1, the instance was not restarted
   kerghan: hint: run 'kerghan update --force' to try again, or 'kerghan up' (which also pulls it)
   ```

   Exit `1`. There is no rollback.
6. **Restart decision** ([below](#restart-decision)).
7. **Result and cleanup hints** ([below](#result-and-cleanup-hints)).

### Restart decision

| Situation | Behaviour |
|-----------|-----------|
| Downgrade (detected per [Rules](#rules), rule 5) | No restart; the downgrade hint of [Why a downgrade never restarts](#why-a-downgrade-never-restarts). |
| `kerghan.env` missing with the data volume present | No restart (`up` would refuse); the env step's warning and hint already said why. |
| Instance not running (previous image empty) | No restart, no prompt; `kerghan: hint: run 'kerghan up' to start Kerghan on <image>`. |
| Running image equals the pulled image (e.g. `--force`, or an `image-tag` override already running) | No prompt, no restart (`up` would find it already running). When the env step added keys: `kerghan: hint: run 'kerghan down && kerghan up' to apply the new kerghan.env variables`; otherwise no hint. |
| `KERGHAN_UPDATE_RESTART=always`, or `restart-on-update=always` | Restart. |
| `KERGHAN_UPDATE_RESTART=never`, or `restart-on-update=never` | No restart; the not-restarted hint below. |
| `restart-on-update=ask` (or unset), TTY | Prompt `Restart Kerghan now? [Y/n] ` on stderr. `Y`, `yes` (any case) or Enter restarts; anything else, and end of input, does not. |
| `restart-on-update=ask` (or unset), no TTY | No prompt, no restart; the not-restarted hint below. |

Rows are checked top to bottom; the first match applies. `KERGHAN_UPDATE_RESTART` (the per-run
override) wins over the setting.

- **Restart** means `kerghan up`'s logic with no flags: it resolves port, variant, image-tag,
  auto-login and bind from `config` and the defaults, compares with the running instance
  (`recreate_reason`, including the warn-and-recreate for a non-release running image), stops it
  and starts it on the new image, keeping the data volume. Flags a previous `kerghan up` was
  given (e.g. `-p 4000` or `--offline`) are not remembered, the same as for a plain
  `kerghan up`: an instance started with `--offline` and no `variant=` line moves to the online
  image.
- **Running it.** `cmd_up` exits on every failure, so the finish step runs it in a subshell:
  `set +e; ( set -e; cmd_up ); rc=$?; set -e` (not `( cmd_up ) || rc=$?`, which disables errexit
  inside the subshell). Whether the container was recreated is told by comparing its ID
  (`docker inspect -f '{{.Id}}' vault-kerghan`) before and after.
- **Not restarted, instance running:**
  `kerghan: hint: run 'kerghan up' to restart Kerghan on <image> (data is kept)`.
- **Restart fails** (e.g. a port conflict): `up`'s error and hints are printed as they are, then
  `kerghan: error: the restart failed; kerghan was updated to 0.9.1`. No rollback. The exit
  status is the restart's.
- **The restart did not recreate the container** (same container ID, `up` found it already
  matching) **but the env step added keys:** the same `down && up` hint as the equal-image row.

### Result and cleanup hints

After the restart decision (and only when nothing failed), on stdout:

| Case | Line |
|------|------|
| `KERGHAN_UPDATE_FROM` set and different from the new version | `kerghan updated 0.9.0 -> 0.9.1` |
| `KERGHAN_UPDATE_FROM` equal to the new version (`--force`) | `kerghan 0.9.1 reinstalled` |
| `KERGHAN_UPDATE_FROM` unset or invalid (`update --finish` run by hand) | `kerghan 0.9.1 is installed` |

Then the cleanup hint, on stderr, only when the previous image is known and differs from the
image just pulled, and never on a downgrade (see
[Why a downgrade never restarts](#why-a-downgrade-never-restarts) for the downgrade's output
order). There is no automatic pruning.

| Instance after the update | Hint |
|---------------------------|------|
| Restarted on the new image | `kerghan: hint: free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0'` |
| Still running the previous image (not restarted) | `kerghan: hint: after 'kerghan up', free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0'` |

Exit `0`.

### Instance state

- **Not running:** the client is replaced and the image pulled; never started, whatever the
  setting (see [Restart decision](#restart-decision)).
- **Running a non-release image** (e.g. a local build): a restart follows `up`'s existing logic
  (warn, then recreate on the release image).
- **Running an older or the same release:** a restart recreates it on the new image; `up`'s
  "already running" case (same image and settings) leaves it as it is.
- **Concurrent `update` runs:** out of scope. The installer's atomic `mv -f` keeps the client
  file consistent.

### Example

An upgrade with `restart-on-update=ask` and a running instance:

```
$ kerghan update
Updating kerghan 0.9.0 -> 0.9.1...
kerghan-install: downloading kerghan 0.9.1
kerghan-install: kerghan 0.9.1 installed to /home/me/.local/bin/kerghan
0.9.1-offline: Pulling from darthjee/kerghan-standalone
...
Restart Kerghan now? [Y/n]
upgrading darthjee/kerghan-standalone:0.9.0-offline -> darthjee/kerghan-standalone:0.9.1-offline
...
Kerghan is running at http://localhost:3000
kerghan updated 0.9.0 -> 0.9.1
kerghan: hint: free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0-offline'
```

### Required tests

In `standalone/test/update.bats`, with `curl`, the installer, `vault` and `docker` stubbed (the
existing `stubs/` convention) and the TTY driven through `KERGHAN_ASSUME_TTY=true`:

- **Usage:** `kerghan help` lists the `update` synopsis and the `Options for update:` block
  verbatim; `--finish` is not listed.
- **Parsing:** two `VERSION`s, `--restart --no-restart`, and an unknown option each exit `2`
  with their message and the usage, before any `curl` call; options before and after `VERSION`
  are accepted.
- **Preconditions:** an invalid `config` line, a client whose real file is not named `kerghan`,
  and a non-writable install dir each fail with exit `1` before any download.
- **Full upgrade flow:** the progress line, the installer run, the handoff, the env step, the
  pull of the right image, the restart and the result line, in that order; exit `0`.
- **Equal image:** with `--force` on the same version and a running instance, no prompt and no
  restart; the `down && up` hint appears only when the env step added keys.
- **Missing `kerghan.env` with a data volume:** the warning and restore hint are printed and no
  restart is attempted.
- **Restart matrix:** each of `always`, `never`, `ask` + `Y`, `ask` + Enter, `ask` + `n`, `ask`
  without a TTY, and unset, crossed with a running and a stopped instance; `--restart` and
  `--no-restart` override each value. A stopped instance is never started and never prompts.
- **Env step:** missing keys are added and named, without values; nothing is printed when none
  is missing; the step is skipped when `kerghan.env` does not exist; `update-env`'s apply line
  is not printed; the `down && up` hint appears when keys were added and the container was not
  recreated.
- **Pull:** `variant=offline` pulls the `-offline` image; an `image-tag` override is pulled and
  warned about; a pull failure exits `1` with the `update --force` hint and no restart.
- **Failures:** an installer failure exits `1` with `still installed` and leaves the client
  file unchanged; an `exec` failure exits `1` with the `kerghan version` hint (both a missing
  and a non-executable new file); a restart failure prints `up`'s hints and
  `the restart failed`, with the restart's exit status.
- **Result and cleanup:** the `updated X -> Y`, `reinstalled` and `is installed` lines; the
  `docker image rm` hint names the previous image after a restart, uses the "after
  'kerghan up'" form when not restarted, and is absent when the instance was stopped or the
  image did not change.
- **No-op stays cheap:** `already up to date` makes one `curl` call and no `docker` call.

## Versions

How `kerghan update` picks the target version and decides what to do with it. All of this runs
in the **old** (currently installed) client, before anything is changed.

### `VERSION` validation

`VERSION` is optional. When given, it must be strict `x.y.z` semver (three dot-separated runs of
digits, the client's `is_semver` rule). A single leading `v` is stripped first, so `v0.9.0`
means `0.9.0`.

Anything else (`latest`, `0.9`, `0.9.0-rc1`, `../0.9.0`, `0.9.0?x`, a value with spaces) is a
usage error, checked before any download:

```
kerghan: error: invalid version 'latest' (expected x.y.z, e.g. 0.9.0)
```

followed by the usage, exit `2`. The value goes into a URL and into an environment variable, so
nothing but digits and dots may reach either (see [Strict `VERSION`](#strict-version)).

### Resolution through the installer stamp line

The target version is read from the release's own `install.sh`, which carries it in its stamp
line, rewritten by `scripts/bump_version.sh` on every release (a
[stable contract](#installer-interface)):

```
KERGHAN_VERSION="0.9.1"
```

| Given | Downloaded |
|-------|------------|
| No `VERSION` | `https://github.com/darthjee/kerghan/releases/latest/download/install.sh` |
| `VERSION` | `https://github.com/darthjee/kerghan/releases/download/<VERSION>/install.sh` |

- **One download.** The file is saved into the staging folder (see
  [Download to a file](#download-to-a-file)) and is the same file the install step runs (see
  [3. Install](#3-install)). Resolution, the existence check and the install cost one HTTP
  request; no GitHub API, no credentials.
- **Reading the stamp:** the first line matching `^KERGHAN_VERSION="[0-9]+\.[0-9]+\.[0-9]+"$`
  (`grep -E '…' file | head -n 1`, as `pinned_version` in `bin/release_kerghan_assets.sh`
  does). The file is only read as text, never sourced or evaluated to find the version.

Every failure below exits `1`, removes the staging folder and changes nothing:

| Case | Message |
|------|---------|
| `VERSION` given, HTTP 404 (the version does not exist) | `kerghan: error: version 0.9.7 does not exist` + `kerghan: hint: see https://github.com/darthjee/kerghan/releases for the available versions` |
| No `VERSION`, HTTP 404 (no release published) | `kerghan: error: no release found at <url>` |
| Any other download failure (no network, DNS, TLS, timeout, other HTTP error) | `kerghan: error: could not download <url>` + `kerghan: hint: check your network connection and that github.com is reachable, then try again` |
| Empty file, or no valid stamp line | `kerghan: error: <url> has no KERGHAN_VERSION="x.y.z" line; nothing was changed` |
| Stamp differs from the requested `VERSION` | `kerghan: error: <url> is for version 0.9.0, not 0.9.1; nothing was changed` |

The HTTP status comes from `curl` itself (`-w '%{http_code}'`), so a 404 is told apart from a
network failure without a second request.

### Comparison

The resolved target is compared with the running client's own `KERGHAN_VERSION` using the
client's `version_compare`. The comparison never touches Docker.

| Case | Result |
|------|--------|
| Target equal to the current version (no `VERSION`, or the same `VERSION`) | No-op, see [Already up to date](#already-up-to-date) |
| Same, with `--force` | Reinstall: the full flow runs, as an upgrade would |
| No `VERSION` and the latest release is **older** than the current version | See [Newer than the latest release](#newer-than-the-latest-release) |
| Target newer | Upgrade: the full flow runs |
| Explicit `VERSION` older | [Downgrade](#downgrade) |
| Current `KERGHAN_VERSION` is not `x.y.z` | See [Non-release client](#non-release-client) |

#### Already up to date

```
kerghan 0.9.1 is already up to date.
```

on stdout, exit `0`. Nothing else runs: no install, no handoff, no Docker call. `--yes`,
`--restart` and `--no-restart` are accepted and have no effect.

#### Newer than the latest release

A plain `kerghan update` whose latest release is older than the current client (a release was
withdrawn, or this is a newer local build that happens to be semver):

```
kerghan 0.9.2 is newer than the latest release 0.9.1; nothing to do.
kerghan: hint: run 'kerghan update 0.9.1' to downgrade to it
```

The first line on stdout, the hint on stderr, exit `0`. A downgrade only ever happens with an
explicit `VERSION`; `--force` does not turn this case into one.

#### Non-release client

When the current `KERGHAN_VERSION` is not `x.y.z` (a development build), no comparison is
possible. The client warns and then runs the full flow to the target, without the no-op and
without the downgrade logic, the same idea as `kerghan up`'s handling of a non-release image:

```
kerghan: warning: this client (dev) is not a release; updating to 0.9.1 without comparing versions
```

`--force` is not needed, and no confirmation is asked.

### Downgrade

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

#### Why a downgrade never restarts

`kerghan up` refuses to recreate a running instance on an image older than the one it runs
(`recreate_reason`: "downgrades are unsupported"), because an older image may not read data a
newer one wrote. The finish step reuses `up`'s logic, so restarting after a downgrade would
always fail. Instead, a downgrade:

- installs the older client and, when the target ships `update`, runs the handoff with its env
  step and pull as usual;
- never restarts, whatever `restart-on-update`, `--restart` or `--no-restart` say. With
  `--restart`, the **old** client adds `kerghan: warning: --restart is ignored on a downgrade`
  to the downgrade warning, on both paths (with and without the handoff), and does not pass
  the override on;
- ends with the hint for the instance state (the new client knows the running image; the old
  client below `FIRST_UPDATE_VERSION` checks it itself):

| Instance | Hint |
|----------|------|
| Running | `kerghan: hint: run 'kerghan down && kerghan up' to switch the instance to 0.9.0 (an older version may not read data written by a newer one)` |
| Not running | `kerghan: hint: run 'kerghan up' to start the instance on 0.9.0` |

The new (older) client recognises the downgrade from the handoff variable `KERGHAN_UPDATE_FROM`
being newer than its own version (see [Rules](#rules), rule 5).

The end of a downgrade with the handoff prints, in this order: the result line
(`kerghan updated 0.9.2 -> 0.9.0`), then the instance-state hint above. No `docker image rm`
hint is printed: the previous image is still the one the instance runs and the user switches
it by hand.

#### Downgrade below `FIRST_UPDATE_VERSION`

`FIRST_UPDATE_VERSION` is a constant in the client: **the first release that contains
`update`**, `0.8.3`. Any value above `0.8.2` and not above that release behaves the same, since
no release lies in between. It must never change once released.

A client older than `FIRST_UPDATE_VERSION` has no `update --finish`, so the handoff cannot run.
Such a downgrade is allowed:

- the same warning and confirmation (or `--yes`) apply;
- the old client runs the installer as usual, which replaces the client;
- it **skips the handoff**: no `exec`, no env update, no pull, no restart;
- it prints, on stdout, `kerghan client replaced: 0.9.2 -> 0.8.2`, then the hint for the
  instance state from the table above (it checks the running container itself), and exits `0`.

### Required tests

In `standalone/test/update.bats`, with `curl` stubbed to serve or fail each URL:

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

## `restart-on-update`

What `kerghan update` does with a **running** instance once the new client and image are
installed. Only `kerghan update` acts on it ([Restart decision](#restart-decision)).

### Key and values

A key in `~/.kerghan/config`, kebab-case like the others:

```
restart-on-update=ask
```

| Value | On `kerghan update`, when the instance is running |
|-------|------|
| `ask` (default) | Prompt `Restart Kerghan now? [Y/n]` on stderr. `Y` / Enter restarts; `n` leaves it running and prints the `kerghan up` hint. Without a TTY (`is_tty` false), no prompt: behaves like `never`. |
| `always` | Restart without asking, the same as `kerghan up`: the container is recreated and the data volume is kept. |
| `never` | No restart; print the `kerghan up` hint. |

- **Default `ask`**, so nothing restarts silently. A missing line and an empty value
  (`restart-on-update=`) both use the default, like every other key.
- **Only a running instance is ever restarted.** With a stopped (or never created) instance,
  every value behaves the same: no restart, no prompt, and the `kerghan up` hint (see
  [Instance state](#instance-state)).
- **A downgrade never restarts**, whatever the value (see [Downgrade](#downgrade)).
- **Per-run override:** `kerghan update --restart` / `--no-restart` win over the setting for
  that run, mirroring `up --[no-]auto-login` (see [Options](#options)). `--yes` does not imply
  a restart; it only confirms a downgrade.
- The exact prompt answers, hints and messages are in [Restart decision](#restart-decision).

### Parser

`restart-on-update` follows the conventions of the other config keys:

- **`CONFIG_KEYS`**: last, after `bind`, so the listing order is `port variant runtime
  stop-timeout image-tag auto-login bind restart-on-update`.
- **Validator:** `valid_restart_on_update` accepts exactly `ask`, `always` and `never`
  (lower-case; no trimming beyond what `load_config` already does).
- **`load_config`:** fills the `CFG_RESTART_ON_UPDATE` global (reset with the others) from a
  `restart-on-update)` case. An invalid value fails through `config_invalid` like the other
  keys:

  ```
  kerghan: error: /home/me/.kerghan/config:9: invalid restart-on-update 'yes' (expected ask, always or never)
  ```

- **Shared writer helpers:** `valid_config_value` maps the key to `valid_restart_on_update`;
  `config_expected` prints `ask, always or never`; `config_default` prints `ask` (the
  `DEFAULT_RESTART_ON_UPDATE=ask` constant).
- The client's header comment, which lists the persistent settings, includes
  `restart-on-update`.
- The description of the `usage` line below starts at column 25, two columns right of the other
  settings, because the key is longer. This is accepted; the other lines are not realigned.

The key is loaded with the rest of the config, so every command that calls `load_config`
validates it. Only `kerghan update` acts on it.

### `kerghan configure`

Handled like every other config key, with no special case:

- **Listing:** a `restart-on-update` row after `bind`, with source `file` or `default` (value
  `ask`), or `file, invalid`.
- **Single read:** `kerghan configure restart-on-update` prints the value in the file, or an
  empty line when unset (the default `ask` applies), like every other key's single read.
- **Set:** `kerghan configure restart-on-update=always` validates with
  `valid_restart_on_update`; an invalid value is refused (exit `1`) with the same expected text.
- **Unset:** `kerghan configure --unset restart-on-update` removes the line, so the default
  applies again.

#### Apply hint

The setting applies to the next `kerghan update`, not to the running instance, so it needs no
restart. The [apply hint](client-config.md#apply-hint) has one row for it:

| Keys changed | Hint |
|--------------|------|
| Only `restart-on-update` | `Takes effect on the next 'kerghan update'.` |

When other keys changed in the same call, the strongest hint of those keys is printed instead
(`down && up` still covers everything), and this line is not printed.

### `kerghan wizard`

Always asked, also without `--advanced`, right after `bind`: the last config question, before
the default-user questions (question 8 of the [wizard questions](client-config.md#questions)).

The exact label is `Restart after update (ask/always/never)`, with the bracket convention of the
other config questions (the current value, or the default when the key has no line):

```
Bind address [127.0.0.1, derived from auto-login]:
Restart after update (ask/always/never) [ask]:
```

- **Enter keeps the bracketed value;** with no line in `config`, nothing is written.
- **An invalid answer** (e.g. `yes`) is re-asked after the validator's message. It is not a
  boolean key: `y` / `n` are not translated.
- **An invalid current value** is shown as invalid with the default offered:
  `Restart after update (ask/always/never) [ask] (current value 'yes' is invalid):`. Enter then
  writes `ask`, which fixes the line.

### Usage and `config.example`

The `usage` settings list has one line after `bind=` (`$DEFAULT_RESTART_ON_UPDATE` expanding to
`ask`):

```
  restart-on-update=$DEFAULT_RESTART_ON_UPDATE  ask | always | never (overridden by update --[no-]restart)
```

and the paragraph after the list ends with:

```
A changed restart-on-update applies to the next 'kerghan update'.
```

`standalone/config.example` has this entry after `bind`:

```
# What `kerghan update` does with a running instance once the new client and
# image are installed: ask | always | never.
#   ask     prompt "Restart Kerghan now? [Y/n]" (without a terminal: like never)
#   always  restart it, like `kerghan up` (the data volume is kept)
#   never   leave it running; `kerghan up` restarts it later
# A stopped instance is never started, and a downgrade never restarts.
# Overridden by `kerghan update --restart` / `kerghan update --no-restart`.
#restart-on-update=ask
```

### Older clients

A client older than this setting (0.8.2 and earlier, or a version a downgrade installs) does not
know the key:

- every command that loads the config (`up`, `down`, `reset`, `update-env`) warns
  `/home/me/.kerghan/config:9: unknown key 'restart-on-update' (ignored)` and carries on;
- its `kerghan configure` lists the key as `unknown (ignored)` and refuses to write it.

This is accepted. The key is never removed automatically; the downgrade warning mentions it (see
[Downgrade](#downgrade)).

### Required tests

In `config.bats`, `configure.bats`, `configure_files.bats` and `wizard.bats`:

- **Parser:** `ask`, `always` and `never` are accepted; an empty value uses `ask`; any other
  value (`yes`, `Always`, `true`) fails `load_config` with exit `1` and the
  `(expected ask, always or never)` message; a missing line uses `ask`.
- **`configure` listing:** the row appears after `bind` with source `default` / `file` /
  `file, invalid`.
- **`configure` read, set and unset:** the single read prints the file value, or an empty line
  when unset; each valid value is written; an invalid one is refused with exit `1` and nothing
  written; `--unset` removes the line.
- **Apply hint:** a change of only `restart-on-update` prints
  `Takes effect on the next 'kerghan update'.`; together with `port` it prints the `kerghan up`
  hint instead.
- **Wizard:** every `wizard.bats` answer sequence has one line (Enter) after the `bind` answer,
  since the question is always asked. The question is asked right after `bind`, with and
  without `--advanced`; Enter keeps the current value (nothing written when unset); an invalid
  answer is re-asked; an invalid current line is offered as `[ask]` and fixed by Enter; `y` is
  refused, not translated.
- **Usage:** `kerghan help` lists `restart-on-update=ask` with its line.
- **`config.example`:** contains the `#restart-on-update=ask` entry.

## Security

How `kerghan update` downloads and runs code safely.

### Trust model

`update` trusts exactly what the first install trusts: the GitHub release of
`darthjee/kerghan`, fetched over HTTPS. The first install runs
`curl -fsSL …/releases/latest/download/install.sh | bash`; `update` downloads the same file (or a
given version's) and runs it.

- **No checksum verification.** `SHA256SUMS` comes from the same release, so it only catches
  corruption in transit, not a compromised release; HTTPS already covers transit. Real
  protection needs signatures, a possible future hardening, out of scope here.
- **HTTPS only.** The client fetches with `curl -fsSL --proto '=https' --proto-redir '=https'`,
  so neither the URL nor a redirect (the `releases/latest` and asset redirects) can fall back to
  plain HTTP.
- The installer it runs then downloads the client from the same release, with the same trust.

### Download to a file

The installer is **never piped into bash**:

- it is downloaded to a file in the staging folder, with `curl -f`, so an HTTP error is a
  failure and not an error page saved as a script;
- a failed, empty or stamp-less download is detected before anything runs (see
  [Resolution through the installer stamp line](#resolution-through-the-installer-stamp-line));
- it is run as `"$BASH" <file>`, never sourced into the client, and the stamp is read as text,
  never evaluated.

### Temp files

- One staging folder per run, created with `mktemp -d` (private, unpredictable name, under
  `TMPDIR`). Nothing is written to a shared or predictable path.
- An `EXIT` trap (also covering `INT` and `TERM`) removes it on every failure path and on
  Ctrl-C (exit `130`).
- **Before the `exec` of the handoff the folder is removed explicitly**, because `exec` replaces
  the process and no trap runs. The below-`FIRST_UPDATE_VERSION` path, which does not `exec`,
  relies on the trap.
- The installer uses its own staging folder, which it cleans up itself.

### Strict `VERSION`

`VERSION` is validated as strict `x.y.z` (one optional leading `v` stripped) before it is used
anywhere (see [`VERSION` validation](#version-validation)). Only digits and dots reach the URL
and the `KERGHAN_VERSION` variable, so values such as `../`, `?`, `#`, `%2e`, spaces or newlines
can never change the URL or inject anything into the installer's environment. The stamp read
from the downloaded file is held to the same rule.

### Exact-path execution

- **Real path.** The client resolves its own file (`BASH_SOURCE[0]`) through the
  `resolve_symlink` helper, then canonicalizes its directory with
  `CDPATH='' cd -P -- "$(dirname "$real")" && pwd -P` (in a subshell), since `resolve_symlink`
  keeps relative parts (a relative link target, or a relative `BASH_SOURCE[0]` under
  `bash kerghan`). `CDPATH=''` keeps a relative directory from resolving into a `CDPATH` entry,
  and `--` keeps a directory starting with `-` from being read as an option. So a client run
  through a symlink (e.g. `/usr/local/bin/kerghan` pointing at `~/.local/bin/kerghan`) updates
  the file actually in use, and the symlink keeps pointing at it.
- **`KERGHAN_INSTALL_DIR`** is the directory of that real file.
- **File name.** The installer always writes `<install dir>/kerghan`. When the real file has
  another name (e.g. a symlink to `kerghan-0.9.0`), updating would write a different file than
  the one in use, so `update` refuses before downloading:

  ```
  kerghan: error: this client runs from /opt/kerghan/kerghan-0.9.0, not a file named 'kerghan'
  kerghan: hint: reinstall with KERGHAN_INSTALL_DIR=<dir> and the installer (curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash)
  ```

  Exit `1`. A path that cannot be resolved (a symlink loop) fails the same way, with
  `resolve_symlink`'s error.
- **Handoff.** The `exec` targets exactly `<install dir>/kerghan`, never a `PATH` lookup, so
  another `kerghan` earlier on `PATH` is never run (see [Handoff interface](#handoff-interface)).
- **Handoff variables** are set and unset explicitly, and validated by the new client before use
  (see [Environment](#environment)).

### No sudo, no credentials

- `update` never uses sudo and never asks for privileges. A non-writable install dir is refused
  before anything is downloaded (see [0. Preconditions](#0-preconditions)), and the installer's
  own check covers a race.
- No GitHub API, no token, no credentials: the release redirects need none, so the
  unauthenticated API rate limit (60 requests per hour) never applies.
- No new network destination: only `github.com` (and its release asset host, through
  redirects) and the Docker registry the pull already uses.

### Secrets

- `update` never prints a `kerghan.env` value, on any path.
- The env step uses the `update-env` logic: it only appends missing keys, keeps every existing
  value byte for byte, keeps the file at mode `600`, and writes atomically through
  `write_file_atomic` (a failed write leaves the file unchanged). It prints the names of added
  keys only, and the existing pointer to where the admin password lives when it generated one.
- Secrets never travel through the handoff: the new client reads `kerghan.env` itself.

### Downgrade risk

Older versions may carry vulnerabilities that later releases fixed. The downgrade warning says
so, and the downgrade needs the `[y/N]` confirmation or an explicit `--yes` (see
[Downgrade](#downgrade)). A downgrade never recreates a running instance on its own, so a newer
instance's data is never opened by an older image without the user running
`kerghan down && kerghan up`.

### Required tests

In `standalone/test/update.bats`:

- **No secrets in the output:** a full update with a `kerghan.env` holding known secret values,
  including one where the env step adds keys, never prints any of those values on stdout or
  stderr.
- **Temp files:** the staging folder is removed after a successful update (before the `exec`),
  after each failure (download, stamp, installer, declined downgrade) and on `INT`.
- **Never piped:** the installer is run as `"$BASH" <file>` (no `bash` stub on `PATH`, which
  would also catch the client's own shebang); the served stub installer records its `$0` (a
  file in the staging folder) and that its stdin is not the script. `curl` is called with `-f`
  and the HTTPS-only options.
- **`VERSION` metacharacters:** `../0.9.0`, `0.9.0?x`, `0.9.0#x`, `0.9.0%2e`, `0.9.0 x` and a
  value with a newline are rejected with exit `2` before any `curl` call.
- **Symlinked client:** run through a symlink (absolute and relative targets), the installer
  receives the target's canonical directory as `KERGHAN_INSTALL_DIR`, the `exec` targets the
  real file, and the symlink is left in place.
- **Other file name:** a client whose real file is not named `kerghan` is refused with exit `1`
  before any download.
- **`PATH` shadowing:** with another `kerghan` first on `PATH`, the handoff still runs the
  installed file.
- **Env permissions:** after the env step adds keys, `kerghan.env` keeps mode `600` and its
  existing lines unchanged.

## Stable contracts

The interfaces `kerghan update` relies on between **different versions** of the client, the
installer and the release.

**Every contract in this section is stable: it can only grow in backward-compatible ways.** An
update always runs code from two versions (the old client starts it, the new client or installer
finishes it), and a downgrade runs code that already shipped and can never change. Breaking any
of these breaks updates started from, or going to, a released version.

### Handoff interface

After the installer has replaced the client, the old client hands the rest of the update to the
new one:

```
exec "<install dir>/kerghan" update --finish
```

- **`<install dir>`** is the directory of the real file of the running client (symlinks
  resolved, see [Exact-path execution](#exact-path-execution)), the same value passed to the
  installer as `KERGHAN_INSTALL_DIR`. It is an absolute path, never a `PATH` lookup.
- **`--finish` is the only argument.** All context travels in environment variables, which an
  older client ignores instead of failing on an unknown option.
- **The staging folder is removed before the `exec`:** an `exec` replaces the process, so an
  `EXIT` trap would never run (see [Temp files](#temp-files)).

#### Environment

| Variable | Value | When unset or invalid |
|----------|-------|------------------|
| `KERGHAN_UPDATE_FROM` | The old client's `KERGHAN_VERSION` (e.g. `0.9.0`) | The finish step still runs; the result line has no "from" part (see [Result and cleanup hints](#result-and-cleanup-hints)) and no downgrade is detected |
| `KERGHAN_UPDATE_RESTART` | `always` or `never`; set only when `--restart` / `--no-restart` was given (and never on a downgrade) | The new client reads `restart-on-update` (see [`restart-on-update`](#restart-on-update)); an empty value counts as unset |

- **The old client always sets or unsets both explicitly** in the `exec`'s environment:
  `KERGHAN_UPDATE_FROM` is always set, and `KERGHAN_UPDATE_RESTART` is set to the override or
  unset. A value already exported in the user's shell never leaks into the handoff.
- **Validation in the new client:** `KERGHAN_UPDATE_FROM` is used only when it matches
  `[A-Za-z0-9._-]{1,64}` (checked with `case` patterns and `${#v}`, bash 3.2 safe; it is
  printed, so nothing else reaches the terminal); a downgrade is detected only when it is
  `x.y.z` and newer than the new client's version (see [Downgrade](#downgrade)).
  `KERGHAN_UPDATE_RESTART` other than `always` / `never` is ignored with
  `kerghan: warning: ignoring KERGHAN_UPDATE_RESTART='<value>' (expected always or never)`.
- **Not passed:** the previous image. The new client reads it from the running container
  before restarting (`running_image`), which also covers an instance started from a non-release
  or overridden image.

#### Rules

1. **`update --finish` stays accepted by every later client.** It can never be removed or
   renamed.
2. **A missing variable falls back to its default** (the table above).
3. **An unknown variable is ignored.** A newer client may add `KERGHAN_UPDATE_*` variables;
   an older target (during a downgrade) never reads them and works as before.
4. **New context is only ever added as new optional variables** with a default that keeps the
   old behaviour. Existing variables never change meaning.
5. **Every client that has `update --finish` skips the restart when `KERGHAN_UPDATE_FROM` is
   `x.y.z` and newer than its own version** (a downgrade, see
   [Why a downgrade never restarts](#why-a-downgrade-never-restarts)). Every future downgrade
   target relies on this, so it can never be dropped. The old client does not signal the
   downgrade through `KERGHAN_UPDATE_RESTART`, which stays reserved for the user's override.

#### `update --finish` by hand

`update --finish` is hidden: it is not in the `usage` text or the user docs. Run by hand, it only
runs the finish steps (env, pull, restart decision, hints) for the installed version, with no
download and no install, so it is harmless. `--finish` must be the only argument: any other
argument with it, before or after (`update --finish extra`, `update 0.9.1 --finish`), is a usage
error (`option '--finish' must be the only argument`, exit `2`).

### Installer interface

`update` runs the downloaded `install.sh` (see [3. Install](#3-install)) with:

```
KERGHAN_VERSION=<target> KERGHAN_INSTALL_DIR=<install dir> "$BASH" <staging>/install.sh
```

It relies only on what the installer has supported since it first shipped:

- **`KERGHAN_VERSION`** selects the client version to download. The client always passes it
  explicitly, so a `KERGHAN_VERSION` exported in the user's shell never applies.
- **`KERGHAN_INSTALL_DIR`** selects the directory; always passed explicitly, with the real
  directory of the running client.
- **The stamp line** `KERGHAN_VERSION="x.y.z"` at the start of a line, which carries the
  release's version (see
  [Resolution through the installer stamp line](#resolution-through-the-installer-stamp-line)).
  `scripts/bump_version.sh` must keep writing it in exactly this format, and the installer's
  header comment documents it as part of this contract.
- **Behaviour:** it never prompts, never uses sudo, refuses to run without a reachable Docker
  (`check_docker`) or a writable install dir (`check_dir`), stages the download and replaces the
  client with `mv -f` as its only write to the install dir, installs `vault` only when it is
  missing, and exits non-zero on any failure of the client or `vault` install; the bash
  completion step only warns (see [Client completion: Never fatal](client-completion.md#never-fatal)).
- **`KERGHAN_COMPLETION`:** `update` does not pass it, so the installer's completion step runs on
  updates unless the user exported `KERGHAN_COMPLETION=false` in their shell (see
  [Client completion: Opt-out](client-completion.md#opt-out)).
- **The client file name is always `kerghan`** in the install dir. When the running client's
  real file has another name, `update` refuses before downloading (see
  [Exact-path execution](#exact-path-execution)).

#### No installer addition is needed

`update` needs nothing the installer does not already do:

- the latest version comes from the stamp line of `releases/latest/download/install.sh`, so no
  "print the version and exit" mode is needed;
- a downgrade runs an older installer that already shipped and can never gain new flags, so any
  addition could only be used by upgrades and would need a fallback anyway;
- the remaining steps (env, pull, restart) belong to the new client, not the installer.

Any future addition to the installer is optional, additive and never relied on for a downgrade.
The bash completion step is one: `update` never relies on it, and it never fails the install.

### Release files

Every release keeps publishing, as GitHub release assets (`bin/release_kerghan_assets.sh`, the
`release-kerghan-assets` CircleCI job):

| Asset | At |
|-------|----|
| `install.sh` (stamped with the release version) | `https://github.com/darthjee/kerghan/releases/download/<v>/install.sh` and `.../releases/latest/download/install.sh` |
| `kerghan` (the client, pinned to the same version) | `https://github.com/darthjee/kerghan/releases/download/<v>/kerghan` and `.../releases/latest/download/kerghan` |

- Release tags stay plain `x.y.z` (no `v` prefix), so `<v>` is the version itself.
- The `latest` release is the highest published version: `releases/latest/download/` must never
  point at an older release than the newest one (or a plain `update` reports "newer than the
  latest release").
- The client asset is published only after the image it pins exists (the existing job order),
  so `update --finish` can always pull it.

### First upgrade

Every release older than `FIRST_UPDATE_VERSION` (`0.8.3`), so 0.8.2 and earlier, has no
`update`. Moving to the first version with `update` means running the installer by hand once,
followed by `kerghan up` (documented in the root `README.md` and
[Upgrading](../standalone.md#upgrading)). From then on, `kerghan update` works.

### Required tests

In `standalone/test/update.bats`, with the installer, `curl`, `vault` and `docker` stubbed:

- **Handoff target:** the `exec` targets `<real install dir>/kerghan` with exactly
  `update --finish`, also when the client was run through a symlink and when another `kerghan`
  comes first on `PATH`.
- **Handoff environment:** `KERGHAN_UPDATE_FROM` is the old version; `KERGHAN_UPDATE_RESTART`
  is `always` with `--restart`, `never` with `--no-restart`, and unset without either, also when
  both variables were pre-set in the calling environment to other values.
- **Staging removed:** the staging folder no longer exists when the new client starts.
- **`--finish` fallbacks:** with neither variable set, the finish step runs and reads
  `restart-on-update`; with `KERGHAN_UPDATE_RESTART=maybe` it warns and reads the setting; with
  `KERGHAN_UPDATE_FROM` containing other characters it is ignored; an empty
  `KERGHAN_UPDATE_RESTART` reads the setting without a warning; an unknown
  `KERGHAN_UPDATE_SOMETHING` variable changes nothing; `update --finish extra` and
  `update 0.9.1 --finish` are usage errors.
- **Downgrade detection:** `KERGHAN_UPDATE_FROM` newer than the client's version skips the
  restart (see [Versions: required tests](#required-tests-1)).
- **Installer environment:** the installer receives `KERGHAN_VERSION=<target>` and
  `KERGHAN_INSTALL_DIR=<real install dir>` even when the calling shell exports other values.
- **Installer stamp format** (in `install.bats`): the stamped `install.sh` has a
  `KERGHAN_VERSION="x.y.z"` stamp line matching the client's version.
