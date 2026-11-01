# `kerghan update [VERSION]`

Updates the installed client and the standalone image together. Built by #417. Overview:
[README.md](README.md); version rules: [versions.md](versions.md); cross-version contracts:
[contracts.md](contracts.md); safety rules: [security.md](security.md).

## Usage

The `usage` command list gains one entry, before `update-env` (verbatim):

```
  update [VERSION] [--force] [--yes] [--[no-]restart]
                                  update the client and the image to VERSION (default: the latest release)
```

and an options block after `Options for up:` (verbatim):

```
Options for update:
  VERSION            release to install, x.y.z (default: the latest release)
  --force            reinstall even when already on that version
  --yes              confirm a downgrade without asking
  --restart          restart a running instance afterwards (overrides restart-on-update)
  --no-restart       leave a running instance as it is (overrides restart-on-update)
```

`update --finish` is hidden and never listed (see
[contracts.md](contracts.md#update---finish-by-hand)). `update` is a new dispatcher entry,
separate from `update-env`; the dispatcher has no prefix matching, so neither changes the other.

## Options

| Option | Effect |
|--------|--------|
| `VERSION` | Target version; validated per [versions.md](versions.md#version-validation). |
| `--force` | Reinstall when the target equals the current version. No effect on any other case (it never skips a downgrade confirmation). |
| `--yes` | Confirms a downgrade without a prompt. Accepted with no effect on an upgrade or a no-op. Never implies a restart. |
| `--restart` | Restart a running instance after the update, whatever `restart-on-update` says. Ignored, with a warning, on a downgrade. |
| `--no-restart` | Never restart, whatever `restart-on-update` says. |

Parsing, before anything else runs (exit `2` with the usage on any error):

- Options and `VERSION` may come in any order.
- A second positional argument: `kerghan: error: only one VERSION can be given`.
- `--restart` together with `--no-restart`: `kerghan: error: options '--restart' and '--no-restart' cannot be combined`.
- Any other option: `kerghan: error: unknown option '<option>'`, as in the other commands.

## Flow

Steps 1–4 run in the **old** client, step 5 in the **new** one.

### 0. Preconditions

Before any download, the old client:

- runs `load_config`, so a broken `~/.kerghan/config` fails now (exit `1`) and not after the
  client was replaced;
- resolves the real path of the running client and its directory, and refuses when the file is
  not named `kerghan` or the path cannot be resolved (see
  [security.md](security.md#exact-path-execution));
- refuses when that directory is not writable, since the installer would fail there anyway:

  ```
  kerghan: error: /home/me/.local/bin is not writable
  kerghan: hint: kerghan update installs to /home/me/.local/bin, where this client runs from; it never uses sudo
  ```

Each refusal exits `1` with nothing changed.

### 1. Resolve

Download the installer and read its stamp line ([versions.md](versions.md#resolution-through-the-installer-stamp-line)).

### 2. Compare

No-op, newer than the latest release, non-release client, upgrade or downgrade with its warning
and confirmation ([versions.md](versions.md#comparison)). Then, on stdout:

| Case | Line |
|------|------|
| Upgrade, or a non-release client | `Updating kerghan 0.9.0 -> 0.9.1...` |
| `--force` on the same version | `Reinstalling kerghan 0.9.1...` |
| Downgrade (confirmed) | `Downgrading kerghan 0.9.2 -> 0.9.0...` |

### 3. Install

Run the downloaded installer with the explicit environment of
[contracts.md](contracts.md#installer-interface). Its output (`kerghan-install: …` lines,
including its own errors and hints) passes through unchanged.

When it exits non-zero, nothing was replaced (its only write is the final `mv -f`):

```
kerghan: error: the installer failed; kerghan 0.9.0 is still installed
```

Exit `1`. Docker not reachable is caught here too: the installer's `check_docker` refuses to run,
with nothing changed.

### 4. Hand off

Remove the staging folder, then `exec` the new client per
[contracts.md](contracts.md#handoff-interface). When the target is older than
`FIRST_UPDATE_VERSION`, skip this step and step 5 (see
[versions.md](versions.md#downgrade-below-first_update_version)).

When the `exec` fails (the new file is missing or not executable), the client may already be
replaced:

```
kerghan: error: could not run /home/me/.local/bin/kerghan update --finish
kerghan: hint: the client may already be updated: check with 'kerghan version', then run 'kerghan up'
```

Exit `1`.

### 5. Finish

`kerghan update --finish`, in the new client, in this order:

1. **Config.** `load_config` (the new client's keys and validators).
2. **Env.** Add missing `kerghan.env` variables with the `update-env` logic
   (`cmd_update_env`'s rules: missing keys only, existing values and permissions kept, atomic
   write, values never printed). When keys were added it prints `Added to <file>: <KEYS>` (and
   the admin-password line when the password was added), but not `update-env`'s own apply line,
   which the restart step replaces. When nothing is missing it prints nothing. When
   `kerghan.env` does not exist the step is skipped silently: there is no installation to update
   yet, and `kerghan up` creates the file. A blank-credential warning is printed as
   `update-env` prints it.
3. **Previous image.** Read the running container's image (`running_image`) before anything
   changes it; empty when the instance is not running.
4. **`image-tag` override.** When `image-tag` is set in `config`, warn (the pull and restart
   use the override):

   ```
   kerghan: warning: image-tag=0.8.1 in ~/.kerghan/config still overrides the pinned image tag (0.9.1)
   kerghan: hint: run 'kerghan configure --unset image-tag' to use the pinned image
   ```

5. **Pull** the image `up` would run: `image_ref` with the configured variant (`variant=offline`
   pulls the `-offline` image; the config wins over the running container, as with `up`) and the
   `image-tag` override when set. `docker pull` runs in the foreground with its progress shown,
   while the old container keeps running, so the downtime is only the recreate. On failure:

   ```
   kerghan: error: could not pull darthjee/kerghan-standalone:0.9.1; kerghan was updated to 0.9.1, the instance was not restarted
   kerghan: hint: run 'kerghan update --force' to try again, or 'kerghan up' (which also pulls it)
   ```

   Exit `1`. There is no rollback.
6. **Restart decision** ([below](#restart-decision)).
7. **Result and cleanup hints** ([below](#result-and-cleanup-hints)).

## Restart decision

| Situation | Behaviour |
|-----------|-----------|
| Downgrade (detected per [versions.md](versions.md#downgrade)) | No restart; the downgrade hint of [versions.md](versions.md#why-a-downgrade-never-restarts). |
| Instance not running (previous image empty) | No restart, no prompt; `kerghan: hint: run 'kerghan up' to start Kerghan on <image>`. |
| `KERGHAN_UPDATE_RESTART=always`, or `restart-on-update=always` | Restart. |
| `KERGHAN_UPDATE_RESTART=never`, or `restart-on-update=never` | No restart; the not-restarted hint below. |
| `restart-on-update=ask` (or unset), TTY | Prompt `Restart Kerghan now? [Y/n] ` on stderr. `Y`, `yes` (any case) or Enter restarts; anything else, and end of input, does not. |
| `restart-on-update=ask` (or unset), no TTY | No prompt, no restart; the not-restarted hint below. |

`KERGHAN_UPDATE_RESTART` (the per-run override) wins over the setting.

- **Restart** means `kerghan up`'s logic with no flags: it resolves port, variant, image-tag,
  auto-login and bind from `config` and the defaults, compares with the running instance
  (`recreate_reason`, including the warn-and-recreate for a non-release running image), stops it
  and starts it on the new image, keeping the data volume. Flags a previous `kerghan up` was
  given (e.g. `-p 4000`) are not remembered, the same as for a plain `kerghan up`.
- **Not restarted, instance running:**
  `kerghan: hint: run 'kerghan up' to restart Kerghan on <image> (data is kept)`.
- **Restart fails** (e.g. a port conflict): `up`'s error and hints are printed as they are, then
  `kerghan: error: the restart failed; kerghan was updated to 0.9.1`. No rollback. The exit
  status is the restart's.
- **The restart did not recreate the container** (`up` found it already matching, e.g. the
  `image-tag` override names the running image) **but the env step added keys:**
  `kerghan: hint: run 'kerghan down && kerghan up' to apply the new kerghan.env variables`.

## Result and cleanup hints

After the restart decision (and only when nothing failed), on stdout:

| Case | Line |
|------|------|
| `KERGHAN_UPDATE_FROM` set and different from the new version | `kerghan updated 0.9.0 -> 0.9.1` |
| `KERGHAN_UPDATE_FROM` equal to the new version (`--force`) | `kerghan 0.9.1 reinstalled` |
| `KERGHAN_UPDATE_FROM` unset or invalid (`update --finish` run by hand) | `kerghan 0.9.1 is installed` |

Then the cleanup hint, on stderr, only when the previous image is known and differs from the
image just pulled. There is no automatic pruning.

| Instance after the update | Hint |
|---------------------------|------|
| Restarted on the new image | `kerghan: hint: free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0'` |
| Still running the previous image (not restarted) | `kerghan: hint: after 'kerghan up', free disk space with 'docker image rm darthjee/kerghan-standalone:0.9.0'` |

Exit `0`.

## Instance state

- **Not running:** the client is replaced and the image pulled; never started, whatever the
  setting (see [Restart decision](#restart-decision)).
- **Running a non-release image** (e.g. a local build): a restart follows `up`'s existing logic
  (warn, then recreate on the release image).
- **Running an older or the same release:** a restart recreates it on the new image; `up`'s
  "already running" case (same image and settings) leaves it as it is.
- **Concurrent `update` runs:** out of scope. The installer's atomic `mv -f` keeps the client
  file consistent.

## Example

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

## Required tests

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
  file unchanged; an `exec` failure exits
  `1` with the `kerghan version` hint; a restart failure prints `up`'s hints and
  `the restart failed`, with the restart's exit status.
- **Result and cleanup:** the `updated X -> Y`, `reinstalled` and `is installed` lines; the
  `docker image rm` hint names the previous image after a restart, uses the "after
  'kerghan up'" form when not restarted, and is absent when the instance was stopped or the
  image did not change.
- **No-op stays cheap:** `already up to date` makes one `curl` call and no `docker` call.
