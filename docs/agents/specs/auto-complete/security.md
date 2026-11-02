# Performance and security

Performance & security items 1–9 from #424. Overview: [README.md](README.md).

## Performance

1. **TAB is pure bash.** Pressing TAB runs no subprocess (no `kerghan`, `docker`, `vault`,
   `curl`, nor external tools such as `grep` or `sed`) and reads no file. Every word list is
   built into the script.
2. **`kerghan completion bash` has no side effects:** it prints the script and exits (see
   [command.md](command.md#no-side-effects)). The `eval` route runs it on every new shell.
3. **The `eval` route costs one client process per shell start.** The docs recommend the
   lazy-loaded bash-completion file installed by `install.sh` (see [install.md](install.md)),
   with `eval "$(kerghan completion bash)"` as the fallback when the `bash-completion` package is
   missing.

## Security

### Trust boundary

4. **The trust boundary doesn't change.** `eval`-ing the client's output trusts nothing beyond
   running the client itself, which the user already does.

### Fixed text

5. **The emitted script is fixed text for a given client version.** It is built only from the
   client's own constants (see [completion.md](completion.md#word-lists)) and never
   interpolates environment variables, config values, `$HOME`, the current directory or any
   path at generation time, so nothing user- or attacker-controlled reaches the `eval`. Two
   runs with different environments print the same bytes.

### Shell hygiene

6. **No changes to the user's shell.** Sourcing the script:
   - defines only `_kerghan` (and `_kerghan_*` helpers) plus the `complete` registration;
   - leaves no global variables behind: every variable in the functions is `local`;
   - changes no shell options: no `set -e` / `-u` / `-o pipefail` (the client's own
     `set -euo pipefail` must not leak into the script), no `shopt`, and no lasting `IFS`
     change;
   - works under a user shell that has `set -u` on: the functions never expand an unset
     variable.

   bash 3.2 compatibility is defined in [completion.md](completion.md#invocation).

### No secrets

7. **Completion never reads `kerghan.env`** (or `~/.kerghan/config`) and never completes values.
   The env key names it offers come from the static `DEFAULT_ENV_KEYS` and are already public in
   the docs.

### Installer writes

8. **The installer's writes are safe:**
   - the temp file is created in the target directory and moved with `mv -f`, which is atomic
     and replaces a symlink at the target rather than following it;
   - the directory is created with `mkdir -p` under the user's umask, and the file is not
     executable;
   - no sudo; writes only under the same user's `BASH_COMPLETION_USER_DIR` / `XDG_DATA_HOME`
     (default `~/.local/share`);
   - the temp file is removed on failure.

### Exact binary

9. **The installer runs `<install dir>/kerghan completion bash`,** the client it just
   installed, by its absolute path, never `kerghan` from `PATH`. This is the same rule as
   `update`'s exec of the exact path (see
   [client-update.md](../../standalone/client-update.md#stable-contracts)).

## Required tests

Mostly in `completion_safety.bats`, which runs in both bash services; the fixed-text case is in
`completion_command.bats` and the installer cases in `install_completion.bats`. Harness and
the fresh-shell method: [README.md](README.md#fresh-shell-tests).

**Representative completions** used by the fresh-shell cases, with their expected replies from
[completion.md](completion.md#required-tests): `kerghan ` (top level), `kerghan up -` (a
flag), `kerghan configure var` (a `configure` key) and `(kerghan configure variant =)` (a
fixed value).

### `completion_safety.bats`

| Label | Setup | Expected |
|-------|-------|----------|
| hygiene: options | fresh `bash --norc --noprofile`; snapshot `set -o`, `shopt` and `IFS`; source the script; snapshot; run one completion; snapshot | all three snapshots identical |
| hygiene: names | same shell; snapshot the `declare -p` names and `declare -F` names before sourcing and after one completion | the only new names are `_kerghan` and `_kerghan_*` functions; no new variable (`COMPREPLY` and the `COMP_*` inputs set by the test excepted) |
| hygiene: `set -u` | same shell with `set -u` on; run the representative completions | the expected replies; stderr empty |
| no subprocess: empty `PATH` | fresh shell; `PATH` set to an empty directory, `HOME` to an empty temp dir; run the representative completions | the expected replies, stderr empty, exit `0` |
| no subprocess: `command_not_found_handle` | bash 5 only (skipped when `BASH_VERSINFO[0] -lt 4`); as above, with a `command_not_found_handle` that appends to a log file | the log file is empty |
| no file read: sentinel config | fresh shell; `HOME` holds `~/.kerghan/config` and `~/.kerghan/kerghan.env` with sentinel keys (e.g. `SENTINEL_KEY=x`) and a sentinel secret value; run the representative completions plus `kerghan configure ` and `kerghan configure --unset ` | replies identical to the empty-`HOME` run; no sentinel key or value in any reply |
| no secret leak: generator | the same sentinel `HOME`; run `kerghan completion bash` | the sentinel value does not appear in the output |
| static deny-list | `kerghan completion bash`, comment lines stripped | contains none of: `$(`, a backtick, `\|`; `<`, `<(`, `>`; `source`, `.` as a command, `eval`, `read`, `exec`; `$HOME`, `~`, `.kerghan` |
| bash 3.2 guard | skipped unless `KERGHAN_TEST_BASH32=1` | `BASH_VERSINFO[0] -eq 3` |

- **Deny-list exceptions:** if the implementation genuinely needs one of the denied tokens,
  the exception is added here explicitly, with the reason; the test then allows exactly that
  occurrence. A false positive just pushes the code to a simpler form.
- **Why three checks:** the empty-`PATH` check misses reads through builtins (`read`, `<`,
  `source`), which the sentinel check catches; neither sees a `$(…)` of builtins only on bash
  3.2, which forks without running a command, so the static deny-list covers it.

### Other files

| Label | File | Setup | Expected |
|-------|------|-------|----------|
| fixed text | `completion_command.bats` | `kerghan completion bash` run twice, with different `HOME`, `PWD`, `XDG_DATA_HOME` and `KERGHAN_*` values | byte-identical outputs |
| installer: temp file | `install_completion.bats` | see [install.md](install.md#required-tests) | the write goes through a temp file in the target directory |
| installer: symlink | `install_completion.bats` | a symlink at the target path, pointing at another file | the symlink is replaced by a regular file; the file it pointed at is unchanged |
| installer: not executable | `install_completion.bats` | a normal install | the file has no execute bit |
| installer: exact binary | `install_completion.bats` | a `kerghan` stub earlier on `PATH` | the file holds the just-installed client's output, not the stub's |

No timing tests: speed is covered structurally by the no-subprocess checks, and wall-clock
assertions would be flaky in CI.
