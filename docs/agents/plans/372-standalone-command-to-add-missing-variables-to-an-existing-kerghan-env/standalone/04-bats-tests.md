# Bats tests

Add `standalone/test/update_env.bats` (`load helpers/setup`, the stubs as in `secrets.bats`). Cases:

- **Missing file, no volume**: exit 1, an error naming `$ENV_FILE`, a hint to run `kerghan up`, no file created, no `openssl` call.
- **Missing file, volume exists** (docker stub reports the volume): exit 1, a hint to restore from a backup or `kerghan reset`, no file created.
- **Up-to-date file** (created by `kerghan up` first, or written by hand): exit 0, says nothing was added, the file is byte-identical (compare with a copy), no new `openssl rand` call.
- **Pre-#371 file** (only the two secrets): adds the five `KERGHAN_DEFAULT_USER_*` keys in order. The password is 48 hex characters from `openssl rand -hex 24`. The output lists the five names and never the password value, and includes the `kerghan down && kerghan up` hint. Neither `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` nor `KERGHAN_DEFAULT_USER_ALLOWED_IPS` is written.
- **Partially missing** (e.g. a custom `KERGHAN_DEFAULT_USER_USERNAME=bob`, plus a comment line and an extra variable such as `KERGHAN_LOG_LEVEL=debug`): only the absent keys are appended. The original lines stay first, unchanged and in order. `bob` is kept.
- **Missing secret**: a file without `KERGHAN_INTEGRATIONS_KEY` gets it from `openssl rand -base64 32`.
- **Blank key** (`KERGHAN_DEFAULT_USER_PASSWORD=` and a bare `KERGHAN_DEFAULT_USER_EMAIL` line): the lines are untouched and not duplicated, a warning names each key, and the command exits 0.
- **Indented key** (`  KERGHAN_DEFAULT_USER_ADMIN=false`): counts as present and is not duplicated.
- **No trailing newline**: the last original line stays intact, and the first appended key is on its own line.
- **Mode**: a file at mode 600 is still 600 afterwards (`stat -c %a`).
- **Idempotent**: a second run adds nothing, leaves the file byte-identical, and says it is up to date.
- **Arguments**: `kerghan update-env --foo` is a usage error.
- **Usage**: `kerghan help` lists `update-env`.

Update `standalone/test/auto_login.bats` (the pre-#371 notice and the explicit `auto-login=true` hint) for the new text from step 03. Check `standalone/test/args.bats` for a usage snapshot or a command list that needs the new line.

## Files to Change
- `standalone/test/update_env.bats` — new.
- `standalone/test/auto_login.bats` — updated message assertions.
- `standalone/test/args.bats` — only if it asserts the usage text or command list.
- `standalone/test/stubs/docker` — only if it cannot already make `docker volume inspect` succeed for a test.
