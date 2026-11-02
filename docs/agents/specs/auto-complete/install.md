# `install.sh` completion setup

The completion step added to `standalone/install.sh`. Built by #430. Overview:
[README.md](README.md).

## Constraint

`install.sh` is a stable contract that `kerghan update` relies on (see its header and
[contracts.md](contracts.md#installer-update-contract)): no prompts, no sudo, `mv -f` as the only
write to the install dir, non-zero exit on any failure, never touches `~/.kerghan` or any Docker
volume. The completion step stays inside that contract, and it never turns a successful client
install into a failure.

The header's "non-zero exit on any failure" gets one deliberate exception: a completion failure
only warns (see [Never fatal](#never-fatal)). #431 rewords the header accordingly (e.g. "any
failure of the client or `vault` install"); `update` relies only on the client install failing
loudly, so this is backward compatible.

The step runs **after** the client is moved into place (`move_client`, itself after
`ensure_vault`), next to `check_path`, so it can run that client.

## Target

```
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

- This is bash-completion v2's user directory. It lazy-loads the file on the first
  `kerghan <TAB>`, with no rc-file edit and no sudo.
- The directory is created with `mkdir -p` when missing.
- The path is documented so users can find or remove the file (there is no uninstaller), and so
  the zsh/fish Epics and any future uninstaller can rely on it (see
  [contracts.md](contracts.md#completion-file-path)).

Rejected:

- **System directories** (`/usr/share/bash-completion/completions`, `/etc/bash_completion.d`):
  they need sudo, which breaks the contract.
- **Editing `~/.bashrc`:** intrusive and hard to keep idempotent.

## Content

- The file holds the **static output of `<install dir>/kerghan completion bash`**: the exact
  client just installed, by its absolute path, never `kerghan` from `PATH` (see
  [security.md](security.md#exact-binary)).
- The output is written to a temp file **in the target directory**, then `mv -f`'d into place,
  the same way the client itself is installed.
- **Refreshed on every run:** every install, every manual rerun, and every `kerghan update`
  (which reruns `install.sh`) rewrites the file, so it always matches the installed client.

Rejected:

- **A loader line** (`eval "$(kerghan completion bash)"` in the file): it runs whichever
  `kerghan` is first on `PATH`, possibly not the one just installed.

## Without the `bash-completion` package

The file is still installed. When bash-completion is not detected, a `hint:` prints the line to
add to `~/.bashrc` by hand: `source "<file>"` (exact text in [Messages](#messages)). This is not
an error and does not change the exit code.

Users may instead load it with `eval "$("<install dir>/kerghan" completion bash)"`, using the
client's absolute path since the install dir may not be on `PATH` (`check_path` may already have
warned about it). The hint doesn't print this form; the user docs can mention it.

**Detection:** bash-completion counts as installed when any of these files exists:

- `/usr/share/bash-completion/bash_completion` (Linux distros)
- `/opt/homebrew/etc/profile.d/bash_completion.sh` (Homebrew, Apple silicon)
- `/usr/local/etc/profile.d/bash_completion.sh` (Homebrew, Intel)
- `/opt/local/etc/profile.d/bash_completion.sh` (MacPorts)

The step only tests that a file exists. It never runs bash-completion and never reads the
user's rc files.

**Detection override (tests only):**

- The four paths above are the default detection list.
- An internal, test-only variable, **`KERGHAN_BASH_COMPLETION_PATHS`** (space-separated paths),
  replaces the list when set. Tests point it at files under the test root, so the result never
  depends on the host or CI image.
- It only decides whether the hint is printed. It never changes the target path or what is
  written.
- It is not a stable contract and is not documented in the `install.sh` header, unlike
  `KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR` and `KERGHAN_COMPLETION`.
- #430 builds it.

Rejected: a test-root prefix on every path (could be mistaken for a general install root), and
the real paths with no override (the result would depend on the host or CI image).

## Never fatal

If the directory can't be created, the client fails to print the script, or the file can't be
written or moved, the step prints a `warning:` and the install continues. The completion step
never fails an install or an `update`; the installer's exit code reflects only the client (and
`vault`) install, as today.

- **Guarded commands:** the installer runs under `set -euo pipefail`, so every command in the
  step is guarded (`if !` / `||`) and reports through `warn` (which does not exit), never
  `error` + `exit 1`.
- **Client without `completion`:** `KERGHAN_VERSION=<older version>` with a newer `install.sh`
  installs a client that has no `completion` command; it exits `2` with empty stdout. The step
  checks the client's exit code and that its output is non-empty before replacing the file, so
  an existing file is never replaced by an empty one.
- **No temp file left behind:** the existing `trap cleanup EXIT` only removes the `$staging`
  folder, and the temp file lives in the completion directory, so the step removes its own temp
  file on failure (inline, or by extending `cleanup`).

## Opt-out

`KERGHAN_COMPLETION=false` skips the step entirely: nothing is created and no hint is printed.

- It joins the installer interface documented in the `install.sh` header (see
  [contracts.md](contracts.md#kerghan_completion)).
- `kerghan update` does not pass it, so the step is **on by default**, including on updates. A
  user who exported `KERGHAN_COMPLETION=false` in their shell keeps the opt-out on updates too,
  since `update` runs the installer with the user's environment.

## Overwrite

An existing file at the target path, including a hand-written one, is replaced by `mv -f` on
every install or update (backward compatibility item 8). This is accepted and documented; the
opt-out is `KERGHAN_COMPLETION=false`.

## Upgrade and downgrade

- **Upgrade from a client without completion** (backward compatibility item 2): `kerghan update`
  runs the new `install.sh`, which installs the file. No manual step, except the `eval` line on
  hosts without `bash-completion`.
- **Downgrade** (backward compatibility item 3): `kerghan update <older version>` runs an older
  `install.sh` that knows nothing about completion. The newer file is left behind and may offer
  commands the older client lacks. This is accepted and documented, not cleaned up. An rc line
  `eval "$(kerghan completion bash)"` then evaluates an empty string (see
  [command.md](command.md#output-and-streams)).

## Uninstall

Out of scope: there is no uninstaller. The file's path is documented in [Target](#target).

## Messages

All messages go through the installer's existing helpers: `info` on stdout, `warn` and `hint`
on stderr, all prefixed `kerghan-install:`. `<file>` is the resolved target path (see
[Target](#target)), `<dir>` its directory, and `<install dir>` the absolute install directory.

**Success:** one `info` line, printed after `kerghan <version> installed to …` and before
`check_path`'s output:

```
kerghan-install: bash completion installed to <file>
```

**bash-completion not detected** (see
[Without the `bash-completion` package](#without-the-bash-completion-package)): printed right
after the success line,

```
kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:
  source "<file>"
```

The second line is printed with `echo … >&2`, the same way `check_path` prints its
`export PATH` line.

**Failure:** one `warn` line naming what failed, and no success line and no hint:

| Failure | stderr |
|---------|--------|
| `mkdir -p` of the directory | `kerghan-install: warning: could not create <dir>; skipping bash completion` |
| the client exits non-zero or prints nothing | `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion` |
| writing the temp file or the `mv -f` | `kerghan-install: warning: could not write <file>; skipping bash completion` |

**`KERGHAN_COMPLETION=false`:** nothing is printed.

The exit code is never changed by this step (see [Never fatal](#never-fatal)).

## Required tests

All in `install_completion.bats` (harness and naming: [README.md](README.md#testing)). It uses
`helpers/install_setup.bash` and runs on bash 5 only: running `install.sh` under bash 3.2 is
#433. Unless a case says otherwise, `KERGHAN_BASH_COMPLETION_PATHS` points at files that don't
exist under the test root (so the hint prints), and the install exits `0`. `<file>` is the
resolved target path and `<install dir>` the test's install directory.

**Target and content**

| Label | Setup | Expected |
|-------|-------|----------|
| target: `BASH_COMPLETION_USER_DIR` | `BASH_COMPLETION_USER_DIR` and `XDG_DATA_HOME` set | the file is `$BASH_COMPLETION_USER_DIR/completions/kerghan` |
| target: `XDG_DATA_HOME` | only `XDG_DATA_HOME` set | the file is `$XDG_DATA_HOME/bash-completion/completions/kerghan` |
| `contract file path` | neither set | the file is `$HOME/.local/share/bash-completion/completions/kerghan` |
| target: directory created | the completions directory doesn't exist | it is created and holds the file |
| exact binary | a `kerghan` stub earlier on `PATH` that prints something else | the file holds `<install dir>/kerghan completion bash`'s output, not the stub's |
| overwrite | a hand-written file already at the target | it is replaced by the client's output |
| `contract KERGHAN_COMPLETION=false` | `KERGHAN_COMPLETION=false` | no file and no directory created; no `bash completion` line on stdout, no hint or `warning:` about completion on stderr |

**Messages**

| Label | Setup | Expected |
|-------|-------|----------|
| success line | a normal install | stdout has `kerghan-install: bash completion installed to <file>`, after the `kerghan <version> installed to …` line and before `check_path`'s output |
| hint printed | no file in `KERGHAN_BASH_COMPLETION_PATHS` exists | the file is installed; stderr has exactly `kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:` then `  source "<file>"`, with the resolved path; exit code unchanged |
| no hint | one file in `KERGHAN_BASH_COMPLETION_PATHS` exists | the file is installed; no `hint:` line about completion; exit code unchanged |

**Never fatal** (each: the exact `warning:` line, no success line, no hint, install exits `0`)

| Label | Setup | Expected stderr |
|-------|-------|-----------------|
| failure: `mkdir` | the target's parent directory is not writable | `kerghan-install: warning: could not create <dir>; skipping bash completion` |
| failure: client exits non-zero | a client that exits `2` with empty stdout (as an older client without `completion`), and an existing file at the target | `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion`; the existing file is untouched |
| failure: client prints nothing | a client that exits `0` with empty stdout, and an existing file at the target | the same `warning:` line; the existing file is untouched |
| failure: write | the target directory exists and is read-only | `kerghan-install: warning: could not write <file>; skipping bash completion`; no temp file is left in the directory |

**Safety** (see [security.md](security.md#required-tests))

| Label | Setup | Expected |
|-------|-------|----------|
| temp file in the target directory | a client stub whose `completion bash` lists the target directory's entries before printing | the listing holds a temp file in that directory; after the install only `kerghan` remains |
| symlink replaced | a symlink at the target path pointing at another file | the target is a regular file; the file it pointed at is unchanged |
| not executable | a normal install | the file has no execute bit |

**`update` contract** (see [contracts.md](contracts.md#required-tests))

| Label | Setup | Expected |
|-------|-------|----------|
| `contract update` | stdin closed, a `sudo` stub that logs its calls | nothing created under `~/.kerghan`; the `sudo` log is empty; no prompt (the install finishes with stdin closed) |
| `contract update`: exit unchanged | the target directory unwritable, compared with a `KERGHAN_COMPLETION=false` run | same exit code; same final output apart from the `warning:` line |

The existing tests in `install.bats` stay untouched: same prompts, exit codes and no sudo. They
run with the completion step on, so they also cover that it changes none of those.
