# Extract the shared missing-env-keys helper

`cmd_update_env` cannot be reused as-is by the finish step (it exits on a missing file, prints
`is up to date` and its own apply line). Extract a helper, e.g. `add_missing_env_keys`, holding:
the missing-key loop over `DEFAULT_ENV_KEYS`, the blank-value warnings and the blank-credential
hint, the byte-for-byte append and `write_file_atomic ... 600`, and the `Added to <file>:<KEYS>`
/ admin-password lines. It returns non-zero on a write failure and reports whether keys were
added through a global (e.g. `ENV_KEYS_ADDED=true|false`), never through a subshell, so the
caller sees it.

`cmd_update_env` keeps its missing-file handling, calls the helper, and prints `is up to date;
nothing was added.` or the `Run 'kerghan down && kerghan up'` apply line exactly as today, so
`update_env.bats` passes unchanged. Values are never printed.

## Files to Change
- `standalone/bin/kerghan` — new `add_missing_env_keys`; `cmd_update_env` refactored onto it.
