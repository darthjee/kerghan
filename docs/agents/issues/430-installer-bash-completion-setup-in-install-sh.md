# Issue: Installer: bash completion setup in `install.sh`

## Description

Implementation sub-issue of the shell autocomplete Epic (#424): make `standalone/install.sh` install bash completion. Built against `docs/agents/specs/auto-complete/install.md`, `contracts.md` and `security.md`; the specs win over this summary. Its dependencies, #434 (constants) and #429 (`kerghan completion bash`), are merged.

### Installer step

- A new step runs right after `move_client` and the `kerghan <version> installed to …` line, before `check_path`.
- It runs `<install dir>/kerghan completion bash`: the client just installed, by its absolute path, never `kerghan` from `PATH`.
- Target: `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`. The directory is created with `mkdir -p` when missing.
- The output goes to a temp file **in the target directory**, then `mv -f` into place. The file is not executable. An existing file (hand-written or a symlink) is replaced on every install, rerun and `kerghan update`.
- The file is replaced only if the client exits `0` **and** prints something. An older client without `completion` (exit `2`, empty stdout) never empties an existing file.
- **Never fatal:** the installer runs under `set -euo pipefail`, so every command in the step is guarded and reports through `warn`, never `error` + `exit 1`. The step removes its own temp file on failure (the existing `cleanup` trap only removes `$staging`).
- **Messages:** use the exact lines in install.md's Messages section.
  - Success is an `info` line.
  - When bash-completion isn't detected, a `hint:` follows with a second `  source "<file>"` line on stderr.
  - Each of the three failures (mkdir, client, write) prints one `warning:` line, with no success line and no hint.
  - `KERGHAN_COMPLETION=false` prints nothing.
- **Detection:** the file-existence check on the four default paths. The test-only override `KERGHAN_BASH_COMPLETION_PATHS` (space-separated) replaces that list; it only decides the hint and is not documented in the header.
- **Opt-out:** `KERGHAN_COMPLETION=false` skips the step: no directory, no file, no output.
- No prompt, no sudo, nothing under `~/.kerghan`. The exit code reflects only the client and `vault` install.

### `install.sh` header (decided here, not in #431)

- Add `KERGHAN_COMPLETION` to the Variables block, next to `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR`.
- Narrow "non-zero exit on any failure" to "any failure of the client or `vault` install", and mention the completion file and its path in the summary paragraph.
- Update install.md's Constraint note, which currently gives this rewording to #431.

### Tests

- A new `standalone/test/install_completion.bats` with every case in install.md's Required tests, using `helpers/install_setup.bash`. It runs on bash 5 only (the `standalone_tests` service). Its name doesn't match the bash 3.2 glob `completion*.bats`, so the bash 3.2 run doesn't pick it up; running `install.sh` under bash 3.2 is #433.
- **Root-proof failure setups:** the bats container runs as root, so a chmod-based setup would be skipped in CI. Instead:
  - the `mkdir` failure puts a regular file in the target path (the `a-file/bin` trick from install.bats);
  - the write failure and `contract update: exit unchanged` use an `mv` wrapper in the test tools dir that fails only for the completion target and calls the real `mv` otherwise.

  install.md's Setup column is updated to match, in the same PR.
- **Stub client:** the curl stub's fake client prints `fake kerghan <v>` for any arguments. Extend it so tests can choose what `completion bash` does: print a script, exit `2` with empty stdout, exit `0` with empty stdout, or list the target directory with bash globs before printing (the tools dir has no `ls`). Keep the existing behaviour as the default.
- The existing `install.bats` tests stay untouched and must still pass with the step on.

### Scope

- In scope: `standalone/install.sh` (step and header), the curl stub and `helpers/install_setup.bash` as needed, `install_completion.bats`, and the install.md updates above.
- Out of scope:
  - the client command (#429, merged);
  - the permanent docs (#431);
  - running the installer tests under bash 3.2 (#433);
  - system-wide completion directories, `~/.bashrc` edits, an uninstaller.

Owner: the standalone agent.

## Expected Behavior

- A fresh install, a rerun and a `kerghan update` each leave a completion file matching the installed client at the resolved target path, and print the success line, plus the hint when bash-completion isn't detected.
- `KERGHAN_COMPLETION=false` creates nothing and prints nothing about completion.
- A completion failure prints exactly one `warning:` line. It leaves any existing file untouched and no temp file behind, and the install still exits `0`.
- Every case in install.md's Required tests passes in CI as root, none skipped. The existing `install.bats` tests pass unchanged.

## Benefits

Completion works out of the box on hosts with bash-completion, stays in sync with the client on every update, and can never break an install or an update.
