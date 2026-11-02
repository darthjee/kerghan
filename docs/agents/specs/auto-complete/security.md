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

5. **The emitted script is fixed text.** It never interpolates environment variables, config
   values, `$HOME`, the current directory or any path at generation time, so nothing user- or
   attacker-controlled reaches the `eval`. Two runs with different environments print the same
   bytes.

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

- Sourcing the script changes no shell option (`set -o` and `shopt` output are unchanged) and
  leaves `IFS` unchanged.
- Sourcing the script and running a completion leave no global variable or function beyond
  `_kerghan` and `_kerghan_*`.
- Completion works in a shell with `set -u` on.
- A completion runs no subprocess and reads no file.
- `kerghan completion bash` prints the same output with different `HOME`, `PWD`,
  `XDG_DATA_HOME` and `KERGHAN_*` values (no environment-derived text).
- The installer writes the completion file through a temp file in the target directory; a
  symlink at the target is replaced, not followed.
- The installed completion file is not executable.
- The installer runs the client from the install dir, not from `PATH`.

> **Open — settled by #428:** the test harness and the full test coverage.
