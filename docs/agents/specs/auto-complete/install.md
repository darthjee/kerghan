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

- The target path resolves to `$BASH_COMPLETION_USER_DIR/completions/kerghan` when that variable
  is set.
- Otherwise it resolves to `$XDG_DATA_HOME/bash-completion/completions/kerghan` when that one is
  set.
- Otherwise it resolves to `$HOME/.local/share/bash-completion/completions/kerghan`.
- The directory is created when missing.
- The file holds the output of `<install dir>/kerghan completion bash`, the client just
  installed, not a `kerghan` found on `PATH`.
- An existing file at the target path is overwritten.
- `KERGHAN_COMPLETION=false` skips the step: no file, and nothing printed.
- A successful step prints `kerghan-install: bash completion installed to <file>` on stdout,
  after the `kerghan <version> installed to …` line.
- When none of the detection paths exists, the file is installed and the exact two-line hint
  from [Messages](#messages) is printed on stderr; the exit code is unchanged. When one exists,
  no hint is printed. (Whether the paths are created under a test root or the list is made
  overridable for tests is #428's choice.)
- Each failure prints its exact `warning:` line from [Messages](#messages), and no success line
  or hint.
- A write failure (e.g. a read-only target directory) prints a `warning:`, leaves no temp file,
  and the install still exits `0`.
- A client without `completion` (non-zero exit or empty output) leaves an existing file
  untouched, prints a `warning:`, and the install still exits `0`.
- The `hint:` shows `source "<file>"` with the resolved target path.
- The step creates nothing under `~/.kerghan`, uses no sudo, and asks no question.

> **Open — settled by #428:** the test harness and the full test coverage.
