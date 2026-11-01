# Stable contracts

The interfaces `kerghan update` relies on between **different versions** of the client, the
installer and the release. Built by #417. Overview: [README.md](README.md).

Every contract on this page is **stable**: once a release ships `update`, it can only grow in
backward-compatible ways. An update always runs code from two versions (the old client starts it,
the new client or installer finishes it), and a downgrade runs code that already shipped and can
never change. Breaking any of these breaks updates started from, or going to, a released
version.

## Handoff interface

After the installer has replaced the client, the old client hands the rest of the update to the
new one:

```
exec "<install dir>/kerghan" update --finish
```

- **`<install dir>`** is the directory of the real file of the running client (symlinks
  resolved, see [security.md](security.md#exact-path-execution)), the same value passed to the
  installer as `KERGHAN_INSTALL_DIR`. It is an absolute path, never a `PATH` lookup.
- **`--finish` is the only argument.** All context travels in environment variables, which an
  older client ignores instead of failing on an unknown option.
- **The staging folder is removed before the `exec`:** an `exec` replaces the process, so an
  `EXIT` trap would never run (see [security.md](security.md#temp-files)).

### Environment

| Variable | Value | When unset or invalid |
|----------|-------|------------------|
| `KERGHAN_UPDATE_FROM` | The old client's `KERGHAN_VERSION` (e.g. `0.9.0`) | The finish step still runs; the result line has no "from" part (see [command.md](command.md#result-and-cleanup-hints)) and no downgrade is detected |
| `KERGHAN_UPDATE_RESTART` | `always` or `never`; set only when `--restart` / `--no-restart` was given | The new client reads `restart-on-update` (see [setting.md](setting.md)) |

- **The old client always sets or unsets both explicitly** in the `exec`'s environment:
  `KERGHAN_UPDATE_FROM` is always set, and `KERGHAN_UPDATE_RESTART` is set to the override or
  unset. A value already exported in the user's shell never leaks into the handoff.
- **Validation in the new client:** `KERGHAN_UPDATE_FROM` is used only when it matches
  `[A-Za-z0-9._-]{1,64}` (it is printed, so nothing else reaches the terminal); a downgrade is
  detected only when it is `x.y.z` and newer than the new client's version (see
  [versions.md](versions.md#downgrade)). `KERGHAN_UPDATE_RESTART` other than `always` / `never`
  is ignored with `kerghan: warning: ignoring KERGHAN_UPDATE_RESTART='<value>' (expected always or never)`.
- **Not passed:** the previous image. The new client reads it from the running container
  before restarting (`running_image`), which also covers an instance started from a non-release
  or overridden image.

### Rules

1. **`update --finish` stays accepted by every later client.** It can never be removed or
   renamed.
2. **A missing variable falls back to its default** (the table above).
3. **An unknown variable is ignored.** A newer client may add `KERGHAN_UPDATE_*` variables;
   an older target (during a downgrade) never reads them and works as before.
4. **New context is only ever added as new optional variables** with a default that keeps the
   old behaviour. Existing variables never change meaning.

### `update --finish` by hand

`update --finish` is hidden: it is not in the `usage` text or the user docs. Run by hand, it only
runs the finish steps (env, pull, restart decision, hints) for the installed version, with no
download and no install, so it is harmless. Any other argument after `--finish` is a usage error
(exit `2`).

## Installer interface

`update` runs the downloaded `install.sh` (see [command.md](command.md#3-install)) with:

```
KERGHAN_VERSION=<target> KERGHAN_INSTALL_DIR=<install dir> bash <staging>/install.sh
```

It relies only on what the installer has supported since it first shipped:

- **`KERGHAN_VERSION`** selects the client version to download. The client always passes it
  explicitly, so a `KERGHAN_VERSION` exported in the user's shell never applies.
- **`KERGHAN_INSTALL_DIR`** selects the directory; always passed explicitly, with the real
  directory of the running client.
- **The stamp line** `KERGHAN_VERSION="x.y.z"` at the start of a line, which carries the
  release's version (see [versions.md](versions.md#resolution-through-the-installer-stamp-line)).
  `scripts/bump_version.sh` must keep writing it in exactly this format, and the installer's
  header comment documents it as part of the contract (#418 folds that note in).
- **Behaviour:** it never prompts, never uses sudo, refuses to run without a reachable Docker
  (`check_docker`) or a writable install dir (`check_dir`), stages the download and replaces the
  client with `mv -f` as its only write to the install dir, installs `vault` only when it is
  missing, and exits non-zero on any failure.
- **The client file name is always `kerghan`** in the install dir. When the running client's
  real file has another name, `update` refuses before downloading (see
  [security.md](security.md#exact-path-execution)).

### No installer addition is needed

`update` needs nothing the installer does not already do:

- the latest version comes from the stamp line of `releases/latest/download/install.sh`, so no
  "print the version and exit" mode is needed;
- a downgrade runs an older installer that already shipped and can never gain new flags, so any
  addition could only be used by upgrades and would need a fallback anyway;
- the remaining steps (env, pull, restart) belong to the new client, not the installer.

**No installer sub-issue is planned.** Writing these specs found no blocker that would need one.
Any future addition to the installer is optional, additive and never relied on for a downgrade.

## Release files

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

## First upgrade

Clients up to 0.8.2 (every version older than `FIRST_UPDATE_VERSION`) have no `update`. Moving to
the first version with `update` still means running the installer by hand once, followed by
`kerghan up`. From then on, `kerghan update` works. #418 documents this in the root `README.md`
and the standalone docs.

## Required tests

In `standalone/test/update.bats`, with the installer, `curl`, `vault` and `docker` stubbed:

- **Handoff target:** the `exec` targets `<real install dir>/kerghan` with exactly `update --finish`,
  also when the client was run through a symlink and when another `kerghan` comes first on
  `PATH`.
- **Handoff environment:** `KERGHAN_UPDATE_FROM` is the old version; `KERGHAN_UPDATE_RESTART`
  is `always` with `--restart`, `never` with `--no-restart`, and unset without either, also when
  both variables were pre-set in the calling environment to other values.
- **Staging removed:** the staging folder no longer exists when the new client starts.
- **`--finish` fallbacks:** with neither variable set, the finish step runs and reads
  `restart-on-update`; with `KERGHAN_UPDATE_RESTART=maybe` it warns and reads the setting; with
  `KERGHAN_UPDATE_FROM` containing other characters it is ignored; an unknown
  `KERGHAN_UPDATE_SOMETHING` variable changes nothing; `update --finish extra` is a usage error.
- **Downgrade detection:** `KERGHAN_UPDATE_FROM` newer than the client's version skips the
  restart (see [versions.md](versions.md#required-tests)).
- **Installer environment:** the installer receives `KERGHAN_VERSION=<target>` and
  `KERGHAN_INSTALL_DIR=<real install dir>` even when the calling shell exports other values.
- **Installer stamp format** (in `install.bats` or the bump script's test): the stamped
  `install.sh` has exactly one `^KERGHAN_VERSION="x.y.z"$` line, matching the release version.
