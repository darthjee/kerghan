# Completion step in install.sh

Add the completion step to `standalone/install.sh`, exactly as `docs/agents/specs/auto-complete/install.md` defines it.

- **Variables** near the top, with the other defaults:
  - `completion_file="${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan"`;
  - the detection list `bash_completion_paths="${KERGHAN_BASH_COMPLETION_PATHS:-/usr/share/bash-completion/bash_completion /opt/homebrew/etc/profile.d/bash_completion.sh /usr/local/etc/profile.d/bash_completion.sh /opt/local/etc/profile.d/bash_completion.sh}"`;
  - `completion_tmp=""` for the cleanup.

  Leave the installer's existing variables alone.
- **`install_completion()`**, called in `main` right after the `kerghan $version installed to …` info line and before `check_path`:
  1. `[ "${KERGHAN_COMPLETION:-}" = "false" ] && return 0`. Nothing is created and nothing is printed.
  2. `dir="${completion_file%/*}"`. `if ! mkdir -p "$dir" 2>/dev/null; then warn "could not create $dir; skipping bash completion"; return 0; fi`.
  3. `if ! completion_tmp="$(mktemp "$dir/.kerghan.XXXXXX" 2>/dev/null)"; then warn "could not write $completion_file; skipping bash completion"; return 0; fi`. The temp file lives in the target directory, so the `mv -f` is atomic and replaces a symlink rather than following it.
  4. `if ! "$install_dir/kerghan" completion bash >"$completion_tmp" 2>/dev/null || [ ! -s "$completion_tmp" ]; then` remove the temp file, set `completion_tmp=""`, then `warn "$install_dir/kerghan completion bash failed; skipping bash completion"; return 0; fi`. Use the absolute path, never `kerghan` from PATH. Check both the exit code and that the output is non-empty, so an older client without `completion` (exit 2, empty stdout) never replaces an existing file.
  5. `if ! mv -f "$completion_tmp" "$completion_file" 2>/dev/null; then` remove the temp file, set `completion_tmp=""`, then `warn "could not write $completion_file; skipping bash completion"; return 0; fi`, then `completion_tmp=""`.
  6. `info "bash completion installed to $completion_file"`.
  7. If none of the detection paths exists (`[ -e "$p" ]` in a `for` loop; never run or source them): `hint "bash-completion was not found; to enable completion, add this to ~/.bashrc:"` and `echo "  source \"$completion_file\"" >&2`.
- **Exact messages:** take them from install.md's Messages section, character for character.
- **`cleanup()`:** also `rm -f "$completion_tmp"` when it is non-empty, so an interrupt between `mktemp` and `mv` leaves no temp file.
- **Guards:** every command is guarded (`if !` / `||`) so `set -euo pipefail` never exits the installer from this step. The step only ever calls `warn`/`info`/`hint`, never `error` or `exit`.
- **Writes:** none under `~/.kerghan`, no sudo, no prompt, no read of rc files or config.

## Files to Change
- `standalone/install.sh` — the new variables, `install_completion()`, the `main` call, and the `cleanup` extension.
