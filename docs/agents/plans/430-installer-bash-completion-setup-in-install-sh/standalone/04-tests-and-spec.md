# install_completion.bats and spec updates

Add `standalone/test/install_completion.bats` (`load helpers/install_setup`, `with_vault` where an install must succeed). Use one `@test` per row of `docs/agents/specs/auto-complete/install.md`'s Required tests, with the spec's labels. The contract rows are named `contract file path`, `contract KERGHAN_COMPLETION=false`, `contract update` and `contract update: exit unchanged`, per the README naming rule.

- **Target and content:**
  - `BASH_COMPLETION_USER_DIR` wins over `XDG_DATA_HOME`;
  - `XDG_DATA_HOME` alone;
  - the default path (contract);
  - the directory is created;
  - exact binary: a `kerghan` stub in `$STUB_BIN` printing `stub on PATH`; the file holds the installed client's marker, not the stub's output;
  - overwrite of a hand-written file;
  - `KERGHAN_COMPLETION=false` (contract): no file, no directory, no completion line on stdout, no completion hint or warning on stderr.
- **Messages:**
  - the success line comes after `kerghan <v> installed to` and before `check_path`'s output. Compare line positions in `$output`, with the install dir off PATH so `check_path` prints;
  - the hint: both exact lines, with the resolved path;
  - no hint when `KERGHAN_BASH_COMPLETION_PATHS` names an existing file under `$TEST_ROOT`.
- **Never fatal** (each: the exact `warning:` line, no success line, no hint, exit `0`):
  - mkdir: `BASH_COMPLETION_USER_DIR` under a regular file;
  - client exits non-zero: `STUB_CLIENT_COMPLETION=missing`, with an existing file left untouched;
  - client prints nothing: `STUB_CLIENT_COMPLETION=empty`, with an existing file left untouched;
  - write: `with_failing_completion_mv`, with no `.kerghan.*` temp file left in the directory.
- **Safety:**
  - temp file in the target directory: `STUB_CLIENT_COMPLETION=list`. The file starts with a `.kerghan.*` entry, and afterwards only `kerghan` remains;
  - symlink replaced: the target is a regular file and the file it pointed at is unchanged;
  - not executable: `[ ! -x "$COMPLETION_FILE" ]`.
- **`update` contract:**
  - stdin closed (`</dev/null`) and a `sudo` stub in `$STUB_BIN` that logs to `$STUB_LOG`: no `sudo` log line, no `~/.kerghan`, exit `0`;
  - exit unchanged: run once with `with_failing_completion_mv` and once with `KERGHAN_COMPLETION=false`. The exit codes are equal, and the outputs are equal once the completion `warning:` line is dropped (filter it out with a bash `while read` loop, not grep, if grep isn't on the test side; the test side has the full container tools, only the installer's PATH is restricted).

**Spec updates** in `docs/agents/specs/auto-complete/install.md`, in the same PR:
- **Constraint section:** the header rewording is done by #430, not #431.
- **Required tests:** change the Setup column of `failure: mkdir` to "`BASH_COMPLETION_USER_DIR` under a regular file", and of `failure: write` and `contract update: exit unchanged` to "an `mv` that fails for the target path". Add one line explaining that the bats container runs as root, so failures are injected rather than made with chmod.
- If `contracts.md`'s `contract update` row says "the target directory unwritable", reword it the same way.

Then run `docker-compose run --rm standalone_tests` and `docker-compose run --rm bats_bash32`; both must pass.

## Files to Change
- `standalone/test/install_completion.bats` — new; every Required test.
- `docs/agents/specs/auto-complete/install.md` — the Constraint note and the Setup column.
- `docs/agents/specs/auto-complete/contracts.md` — the `contract update` setup wording, if needed.
