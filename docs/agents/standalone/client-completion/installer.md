# Installer setup

Part of [Standalone: client completion](../client-completion.md). This page specifies `install_completion` in `standalone/install.sh`: destination, content, detection and hint, failure handling, opt-out, overwrite/downgrade behavior, messages and required tests.

## Constraint and order

`install.sh` is a stable contract used by `kerghan update`: no prompts, no sudo, `mv -f` as the only write to the install directory, and no touching `~/.kerghan` or Docker volumes. Completion runs after `move_client` (itself after `ensure_vault`), next to `check_path`, so it invokes the newly installed client. Completion failures are the deliberate non-fatal exception: they warn but do not turn a successful client/Vault install or update into a failure.

## Target

```text
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

This is the bash-completion v2 user directory. The step creates it with `mkdir -p`; bash-completion lazy-loads the file on the first `kerghan <TAB>`. There is no rc-file edit and no sudo. The path is documented because there is no uninstaller and future shell support may rely on it.

System completion directories were rejected because they require sudo. Editing `~/.bashrc` was rejected as intrusive and difficult to keep idempotent.

## Content and refresh

The file contains the static output of `<install dir>/kerghan completion bash`, using the absolute path to the exact client just installed, never a `kerghan` selected through `PATH`. It writes to a temporary file in the target directory and uses `mv -f` to install it. Every installer run, manual rerun and `kerghan update` refreshes the file.

A loader line such as `eval "$(kerghan completion bash)"` is not stored in the file: it could run another binary earlier on `PATH`.

## Detection and hint

The file is installed even when bash-completion is not detected. In that case the installer prints a hint to source it manually:

```text
kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:
  source "<file>"
```

Detection checks only whether any of these files exists; it never runs bash-completion or reads the user's rc files:

- `/usr/share/bash-completion/bash_completion`
- `/opt/homebrew/etc/profile.d/bash_completion.sh`
- `/usr/local/etc/profile.d/bash_completion.sh`
- `/opt/local/etc/profile.d/bash_completion.sh`

Tests may set the internal `KERGHAN_BASH_COMPLETION_PATHS` (space-separated paths) to replace that list. It only controls hint output, not the target or written content; it is not a stable installer interface and is not documented in the installer header.

## Non-fatal failure handling

The installer uses `set -euo pipefail`, so every completion command must be guarded and report through `warn`, never `error`/`exit 1`. If directory creation, script generation, temp-file writing or moving fails, it prints one warning and continues. The completion step never changes the installer exit code.

An older client without `completion` exits non-zero with empty stdout. The step checks both the exit code and non-empty output before replacing the target, preserving any existing completion file. Its temp file is cleaned up on failure; the existing exit trap only removes the staging directory, so the completion step must clean its own temp file.

| Failure | Warning |
|---------|---------|
| Cannot create directory | `kerghan-install: warning: could not create <dir>; skipping bash completion` |
| Client command fails or prints nothing | `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion` |
| Cannot write or move temp file | `kerghan-install: warning: could not write <file>; skipping bash completion` |

## Opt-out, overwrite and downgrade

`KERGHAN_COMPLETION=false` skips the step entirely: no directory/file, success line, hint or completion warning. It is on by default, including for `kerghan update`; an exported opt-out is inherited by the installer.

Every run replaces any existing target, including hand-written content. This is documented behavior; opt out to retain a custom file.

Upgrading from a client without completion installs the new file automatically. Downgrading runs an older installer that does not know about the file, so the newer completion is left behind and may offer commands unavailable in the older client. This is accepted and documented, not cleaned up.

There is no uninstaller; users can remove the file at the documented target path.

## Messages

The existing helpers prefix messages with `kerghan-install:`. `info` goes to stdout; `warn` and `hint` go to stderr. On success, after the installed-client line and before `check_path` output:

```text
kerghan-install: bash completion installed to <file>
```

If bash-completion is missing, the hint follows that line. A failure prints only its warning: no success line or hint. Opt-out prints nothing for completion. The exit code is unaffected.

## Required installer tests

All tests are in `standalone/test/install_completion.bats` and use `helpers/install_setup.bash`, under bash 5 and bash 3.2. The test override makes host detection deterministic.

- Target resolution for `BASH_COMPLETION_USER_DIR`, `XDG_DATA_HOME`, and default `$HOME/.local/share`; directory creation; exact installed binary despite a PATH stub; and overwrite.
- Opt-out creates no directory or file and prints no completion messages. Normal success prints the success line in order; hint appears only when no detection file exists.
- Injected mkdir, client-exit, empty-output and move/write failures assert their exact warnings, exit `0`, no hint/success output and preservation of old files/temp cleanup.
- Safety checks verify a temp file is created in the target directory, a symlink is replaced without changing its referent, and the resulting file is not executable.
- Update-contract checks close stdin and stub sudo, verify no prompt/no sudo/no writes under `~/.kerghan`, and compare exit/output with an opt-out run when the completion move fails.

The existing `install.bats` tests remain unchanged and continue to cover prompts, exit codes and no sudo. See [Stable contracts](security-contracts.md#installer-update-contract).
