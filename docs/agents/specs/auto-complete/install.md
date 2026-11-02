# `install.sh` completion setup

The completion step added to `standalone/install.sh`. Built by #430. Overview:
[README.md](README.md).

## Constraint

`install.sh` is a stable contract that `kerghan update` relies on (see its header and
[contracts.md](contracts.md#installer-update-contract)): no prompts, no sudo, `mv -f` as the only
write, non-zero exit on any failure of the client install, never touches `~/.kerghan` or any
Docker volume. The completion step stays inside that contract, and it never turns a successful
client install into a failure.

The step runs **after** the client is installed, so it can run that client.

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
add to the shell rc file by hand: `eval "$(kerghan completion bash)"`, or `source <file>`. This
is not an error and does not change the exit code.

## Never fatal

If the directory can't be created, the client fails to print the script, or the file can't be
written or moved, the step prints a `warning:` and the install continues. The completion step
never fails an install or an `update`; the installer's exit code reflects only the client (and
`vault`) install, as today. A failed step leaves no temp file behind.

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

> **Open — settled by #427:** the exact `hint:`, `warning:` and success text of the completion
> step (through the installer's `kerghan-install:` helpers).

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
- `KERGHAN_COMPLETION=false` skips the step: no file, no hint.
- Without bash-completion, the file is installed and a `hint:` is printed; the exit code is
  unchanged.
- A write failure (e.g. a read-only target directory) prints a `warning:`, leaves no temp file,
  and the install still exits `0`.
- The step creates nothing under `~/.kerghan`, uses no sudo, and asks no question.

> **Open — settled by #428:** the test harness and the full test coverage.
