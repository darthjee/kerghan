# install.md detection override and Required tests

Specify the test-only detection override, rewrite `install.md`'s Required tests as concrete cases for `install_completion.bats`, and remove its `Open — settled by #428` marker.

**Detection override.** Under `## Without the bash-completion package`, after the four paths, add:

- the four paths are the default detection list;
- an internal, test-only variable, `KERGHAN_BASH_COMPLETION_PATHS` (space-separated), replaces the list when set;
- it only decides whether the hint is printed, and never changes the target path or what is written;
- it is not a stable contract and is not documented in the `install.sh` header (unlike `KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR` and `KERGHAN_COMPLETION`);
- #430 builds it.

Replace the parenthetical "(Whether the paths are created under a test root … is #428's choice.)" with a link to this.

**Required tests → `install_completion.bats`.** It uses `helpers/install_setup.bash` and runs on bash 5 only (running `install.sh` under 3.2 is #433). Each case gives the setup, the expected file/stdout/stderr and the exit code:

- **Target path:**
  - `BASH_COMPLETION_USER_DIR` set gives `$BASH_COMPLETION_USER_DIR/completions/kerghan`;
  - otherwise `XDG_DATA_HOME` set gives `$XDG_DATA_HOME/bash-completion/completions/kerghan`;
  - otherwise `$HOME/.local/share/bash-completion/completions/kerghan` (`contract file path`);
  - the directory is created when missing.
- **Exact binary:** a `kerghan` stub earlier on `PATH` that prints something else. The file holds the just-installed client's `completion bash` output.
- **Overwrite:** an existing file, including a hand-written one, is replaced.
- **Opt-out** (`contract KERGHAN_COMPLETION=false`): no file and no completion output.
- **Success line:** stdout has `kerghan-install: bash completion installed to <file>` after the `kerghan <version> installed to …` line and before `check_path`'s output.
- **Hint:**
  - With `KERGHAN_BASH_COMPLETION_PATHS` pointing at missing files under the test root, the file is installed and stderr has the exact two-line hint, with `source "<file>"` showing the resolved path.
  - With a listed file existing, there is no hint.
  - The exit code is unchanged in both.
- **Failures:** each of the three exact `warning:` lines, with no success line and no hint, and the install exits `0`:
  - an unwritable parent, so `mkdir` fails;
  - a client stub that exits non-zero or prints nothing, which also leaves an existing file untouched;
  - a read-only target directory, which also leaves no temp file.
- **Safety** (see [security.md](security.md#required-tests)):
  - writes go through a temp file in the target directory;
  - a symlink at the target is replaced, not followed;
  - the file is not executable.
- **`update` contract:**
  - nothing is created under `~/.kerghan`, no sudo, no prompt (stdin closed);
  - with the target directory unwritable, the installer's exit code and final output match a run without the completion step, apart from the warning line.
- **Existing installer tests stay untouched:** one sentence saying so.

## Files to Change
- `docs/agents/specs/auto-complete/install.md` — the detection override, concrete Required tests, the parenthetical replaced, the marker removed.
