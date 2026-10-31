# ensure_env_file on the writer
Replace the `mkdir -p` / `umask 077` subshell / `>` / `chmod 600` block of `ensure_env_file` with
`write_file_atomic "$ENV_FILE" "$content"$'\n' 600 || return 1` (content keeps today's trailing
newline: `printf '%s\n'`). The writer already creates the directory, so `mkdir -p "$KERGHAN_HOME"`
can go unless something else relies on it. Print the "Generated secrets in …" message only after a
successful write. Keep the `[ -e "$ENV_FILE" ] && return 0` guard as is. Update the function's
comment to say it writes atomically through `write_file_atomic`.

Propagate the new failure in the callers: `cmd_up` should stop (exit 1) when it fails — under
`set -e` a bare call already exits, but make it explicit (`ensure_env_file || exit 1`) for
readability; in `batch_apply` use `ensure_env_file || return 1` so `configure`/`wizard` report the
failure like any other failed write.

## Files to Change
- `standalone/bin/kerghan` — `ensure_env_file`, its call sites in `cmd_up` and `batch_apply`.
