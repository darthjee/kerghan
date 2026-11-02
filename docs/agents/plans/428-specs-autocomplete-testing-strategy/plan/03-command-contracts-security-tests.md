# command, contracts and security Required tests

Rewrite the Required tests in `command.md`, `contracts.md` and `security.md` as concrete cases (same `Label | Input or setup | Expected` table shape as step 02, plus the target file), and remove their `Open — settled by #428` markers.

**`command.md` → `completion_command.bats`**

- `kerghan completion bash`: exit `0`, the script on stdout, empty stderr (`contract completion bash`).
- One row per error from the "Error messages" table: exit `2`, exact first stderr line, the full usage after it, empty stdout. Add `completion zsh extra` (unsupported shell), `completion -x extra` (unknown option) and `completion Bash` (`unsupported shell 'Bash' (supported: bash)`).
- Usage: `kerghan help` contains the exact `completion bash` line, between the `wizard` and `version` lines.
- No side effects: with the stubs, `STUB_LOG` stays empty, `find "$HOME"` is identical before and after, and `~/.kerghan` doesn't exist.

**`contracts.md`**

Label each row `contract <name>` and point it at its file:

- `completion bash`, `_kerghan`, and `complete -o nospace -F _kerghan kg` then words `(kg …)` complete like `(kerghan …)`: all in `completion_command.bats`.
- The file path and `KERGHAN_COMPLETION=false`: in `install_completion.bats`.
- The `update` contract (no prompt, no sudo, unchanged exit code): in `install_completion.bats`.
- The sync rule: point to the sync cases in [completion.md](completion.md#required-tests).

**`security.md` → `completion_safety.bats`** (and `completion_command.bats` / `install_completion.bats` where noted)

- **Hygiene snapshot** in a fresh `bash --norc --noprofile`:
  - `set -o`, `shopt` and `IFS` are unchanged after sourcing and after one completion;
  - no new variable or function besides `_kerghan` and `_kerghan_*`;
  - the representative completions also pass with `set -u`.
- **Empty `PATH`:** the representative completions (top level, a flag, a `configure` key, a fixed value) return their expected replies with empty stderr and exit `0`. On bash 5, the `command_not_found_handle` log stays empty.
- **Sentinel config:** `~/.kerghan/config` and `kerghan.env` hold sentinel keys and a sentinel secret value. Replies are identical to the empty-`HOME` run, and no sentinel appears in any reply or in the generator output (no secret leak).
- **Static deny-list** on the printed script, comment lines stripped. It contains none of:
  - `$(`, backtick or `|`;
  - `<`, `<(` or `>`;
  - `source`, `.` as a command, `eval`, `read` or `exec`;
  - `$HOME`, `~` or `.kerghan`.

  A needed exception is added to this spec explicitly.
- **`BASH_VERSINFO` guard:** skipped unless `KERGHAN_TEST_BASH32=1`, and then `BASH_VERSINFO[0] -eq 3`.
- **Fixed text:** the generator output is identical across `HOME`, `PWD`, `XDG_DATA_HOME` and `KERGHAN_*` values (`completion_command.bats`).
- **Installer writes:** the temp file in the target directory, the symlink replaced not followed, and the file not executable (`install_completion.bats`, see [install.md](install.md#required-tests)).
- No timing tests; one sentence saying speed is covered structurally by the no-subprocess checks.

## Files to Change
- `docs/agents/specs/auto-complete/command.md` — concrete Required tests; marker removed.
- `docs/agents/specs/auto-complete/contracts.md` — `contract <name>` cases mapped to files; marker removed.
- `docs/agents/specs/auto-complete/security.md` — concrete safety and hygiene cases; marker removed.
