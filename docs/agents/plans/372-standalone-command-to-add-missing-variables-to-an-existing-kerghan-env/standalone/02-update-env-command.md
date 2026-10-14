# Add the update-env command

Add `cmd_update_env` and dispatch `update-env` from `main`.

Behavior:

1. Any argument fails with `usage_error "unknown option '$1'"`, like `cmd_reset`. Load the config with `load_config`, as the other commands do, so a broken config fails the same way.
2. If `$ENV_FILE` does not exist, exit 1 and write nothing. Print `error "$ENV_FILE does not exist"`, then a hint. When `volume_exists`: restore `kerghan.env` from a backup (the data was written with those secrets), or run `kerghan reset`. This reuses the wording of the hint in `cmd_up`. Otherwise: run `kerghan up` to create a new installation.
3. Find the line for each key with the same pattern as `refuse_client_managed_keys`: `^[[:space:]]*KEY(=|[[:space:]]*$)`. Then sort each key into one of three groups:
   - **missing**: no line at all. Append it.
   - **blank**: there is a line but `env_file_sets KEY` is false (an empty value, or a bare `KEY` line). Leave it as it is and print `warn "$ENV_FILE has a blank KEY; left as it is"`. For `KERGHAN_DEFAULT_USER_USERNAME`, `KERGHAN_DEFAULT_USER_EMAIL` and `KERGHAN_DEFAULT_USER_PASSWORD`, add that `kerghan up` will still treat the default user as missing. One `hint` line after the warnings is enough.
   - **set**: leave it as it is.
4. When some keys are missing, append them in list order, using the values from `default_env_value`. Generate values only for the missing keys, so no `openssl` call runs for present keys. If the file is not empty and its last byte is not a newline (`[ -n "$(tail -c1 "$ENV_FILE")" ]`), append a newline first. Append with `>>` so the inode, the mode and the existing content stay. Then run `chmod 600 "$ENV_FILE"`, the same as `ensure_env_file`.
5. Output:
   - something added: `Added to $ENV_FILE: KEY1 KEY2 ...` (names only), then `Run 'kerghan down && kerghan up' to apply the change.` When `KERGHAN_DEFAULT_USER_PASSWORD` was added, also say that the admin password is in that file.
   - nothing missing: `$ENV_FILE is up to date; nothing was added.` (the blank warnings, if any, still print).
6. Exit 0 in both cases, blank warnings included. Never touch Docker except the read-only `volume_exists` check in the missing-file case.

Update `usage`: add the line `update-env                      add missing variables to ~/.kerghan/kerghan.env (keeps existing values)` after `reset`.

## Files to Change
- `standalone/bin/kerghan` — `cmd_update_env`, the `main` dispatch, and the `usage` text.
