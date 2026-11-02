# `completion_safety.bats` and `completion_sync.bats`

Write the cases from `security.md` → `### completion_safety.bats` and `completion.md` → `### completion_sync.bats`.

- **`standalone/test/completion_safety.bats`.** Every case runs in a fresh `bash --norc --noprofile` driven by a small script (README `### Fresh-shell tests`), not in the bats shell. All of them use the representative completions:
  - `kerghan ` (top level);
  - `kerghan up -` (a flag);
  - `kerghan configure var` (a `configure` key);
  - `(kerghan configure variant =)` (a fixed value).

  The cases:
  - `hygiene: options`: the `set -o`, `shopt` and `IFS` snapshots are identical before sourcing, after sourcing and after a completion;
  - `hygiene: names`: the only new `declare -F` names are `_kerghan` and `_kerghan_*`, and there's no new variable (apart from `COMPREPLY` and the `COMP_*` the script sets);
  - `hygiene: set -u`: same replies, stderr empty;
  - `no subprocess: empty PATH`: `PATH` is an empty directory and `HOME` an empty temp dir; expected replies, stderr empty, exit `0`;
  - `no subprocess: command_not_found_handle`: skipped when `BASH_VERSINFO[0] -lt 4`; the handler's log stays empty;
  - `no file read: sentinel config`: `~/.kerghan/config` and `kerghan.env` hold sentinel keys and a secret value. Replies, including `kerghan configure ` and `kerghan configure --unset `, match the empty-`HOME` run, and no sentinel appears;
  - `no secret leak: generator`: the sentinel value isn't in the output of `kerghan completion bash`;
  - `static deny-list`: with comment lines removed, the output contains none of the denied tokens. Match `.` as a command and `read`/`exec`/`eval`/`source` as words, not substrings, so names like `readonly` or `_kerghan_reads` don't give false positives.
  - `bash 3.2 guard`: skipped unless `KERGHAN_TEST_BASH32=1`, then asserts `BASH_VERSINFO[0] -eq 3`.
- **`standalone/test/completion_sync.bats`:**
  - **`kerghan help` cross-check.** Read the commands and per-command flags from the usage text and compare them, as sets, with the completion's replies (`kerghan ` and each command's `-`). The commented exclusion list holds `--finish`.
  - **Generated lists.** Source the client through its `BASH_SOURCE` guard, then read `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, the `FRONTEND_BASE_URL` constant and the four value constants. `kerghan configure ` offers each config and env key as `KEY=`. `kerghan configure --unset ` offers exactly the config keys plus `FRONTEND_BASE_URL`. Each `KEY=` value list equals that key's value constant.
  - **Classification.** Every `CONFIG_KEYS` entry is either in the commented `FREE_FORM_KEYS` list (`port bind image-tag stop-timeout`) or has a value constant, never both and never neither.
  - Source the client in a subshell or the test shell, after `setup`. The client sets `set -euo pipefail` at top level, so restore bats-friendly options if needed and say why in a comment.

## Files to Change

- `standalone/test/completion_safety.bats`: new.
- `standalone/test/completion_sync.bats`: new.
