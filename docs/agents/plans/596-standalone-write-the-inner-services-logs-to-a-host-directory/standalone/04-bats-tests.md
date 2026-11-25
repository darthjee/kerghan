# bats tests

Run with `docker-compose run --rm standalone_tests` and
`docker-compose run --rm standalone_tests_bash32`, never on the host.

## Keep the churn small

Six files hard-code the full `vault up` line:
- `args.bats`
- `upgrade.bats`
- `auto_login.bats`
- `bind.bats`
- `frontend_base_url.bats`
- `recreate_settings.bats` (`up_line`), plus `config.bats:11` (`up_line`)

Add a `LOG_ARGS` / `log_args` helper to `standalone/test/helpers/setup.bash` (like
`DEFAULT_USER_ARGS`) with the default words:
`-e KERGHAN_FILE_LOGS=true -e KERGHAN_HOST_UID=<uid> -e KERGHAN_HOST_GID=<gid> -v $HOME/.kerghan/logs:/vault/logs`.
Use it in all of those assertions.

## Stub changes

- `standalone/test/stubs/docker`: add an inspect branch for the `.Mounts` format, driven by a new
  `STUB_LOG_MOUNT` variable. Add it to the reset list in `setup()`. `.Config.Env` already supports
  arbitrary values, so set `KERGHAN_FILE_LOGS` through the existing env stub variable.
- Unwritable directory: tests run as **root** in CI, so mode bits cannot make a directory
  unwritable. Add a `mktemp` stub (or extend an existing one) that fails when its template is under
  a path given by `STUB_UNWRITABLE_DIR`, and otherwise defers to the real `mktemp`.

## New `standalone/test/file_logs.bats`

- Default `up` → `vault up` gets the `-e` triple and `-v ~/.kerghan/logs:/vault/logs`, and the
  directory is created with mode `700` (`file_mode`).
- `log-dir=~/custom` → `-v $HOME/custom:/vault/logs`. `log-dir=/abs/path` → used as is.
- `file-logs=false` → `-e KERGHAN_FILE_LOGS=false` and **no** `-v`.
- Unwritable directory → a warning on stderr, `KERGHAN_FILE_LOGS=false`, no `-v`, and `up`
  succeeds.
- `id -u` and `id -g` values reach `-e` (stub `id`, or compare with the real `id` output).
- A `KERGHAN_FILE_LOGS`, `KERGHAN_HOST_UID` or `KERGHAN_HOST_GID` line in `kerghan.env` is refused
  (client-managed).
- Older image hint: `image-tag` below `FIRST_FILE_LOGS_VERSION` → the hint is printed and `up`
  succeeds. A non-semver tag → no hint.

## Config tests

- `config.bats`: an invalid `log-dir` (relative, with `:`, with spaces) fails with the line
  number and leaves the instance untouched. An invalid `file-logs` (not `true`/`false`) fails the
  same way.
- `configure.bats:15-31`: update the listing positions and the line count for the two new rows.
  Add `configure file-logs=false`, `configure log-dir=~/x`, and the rejected values.
- `wizard.bats`: the prompt regex (:25), `DEFAULT_ORDER`/`ADVANCED_ORDER` (:66-67), the explicit
  orders (:202, :244), and a test that `log-dir` is skipped when `file-logs` is false.
- `standalone/test/helpers/completion.bash:15` (`CONFIG_KEYS_EQ`) and `completion_sync.bats`:
  `file-logs` completes `true false`, and `log-dir` is free-form.

## Recreate tests (`recreate_settings.bats`)

- Running with `KERGHAN_FILE_LOGS=true` and the same mount → no recreate.
- Running without `KERGHAN_FILE_LOGS` in its env (older client) and file logs on → recreate.
- `file-logs` changed to `false` while the running instance has it on → recreate.
- Mount source different from the resolved `log-dir` → recreate, with the "log directory changed"
  message.

## Files to Change

- `standalone/test/helpers/setup.bash`: the `LOG_ARGS` helper and the new stub variables in
  `setup()`.
- `standalone/test/helpers/completion.bash`: `CONFIG_KEYS_EQ`.
- `standalone/test/stubs/docker`: the `.Mounts` branch.
- `standalone/test/stubs/mktemp` (new, or extend an existing stub): the unwritable probe.
- `standalone/test/file_logs.bats` (new).
- `standalone/test/args.bats`, `upgrade.bats`, `auto_login.bats`, `bind.bats`,
  `frontend_base_url.bats`, `recreate_settings.bats`, `config.bats`, `configure.bats`,
  `wizard.bats`, `completion_sync.bats`: updated assertions and new cases.
