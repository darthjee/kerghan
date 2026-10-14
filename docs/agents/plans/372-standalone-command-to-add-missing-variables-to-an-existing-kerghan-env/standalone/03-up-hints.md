# Point up's notice and hint at update-env

In `cmd_up`, a `kerghan.env` without the default user triggers two messages. Change both to name the command:

- the notice when `auto-login` falls back to `false`: `Automatic login is off: $ENV_FILE has no default user. To turn it on, run 'kerghan update-env', then 'kerghan up' again.` Keep the existing phrase `add the KERGHAN_DEFAULT_USER_* values to kerghan.env` only if the tests still need it, or update the tests in step 04.
- the hint after the explicit `auto-login=true` error: `run 'kerghan update-env' to add the default user to kerghan.env, or use 'kerghan up --no-auto-login' (or auto-login=false in ~/.kerghan/config)`.

Also update the `auto-login` comment block in `standalone/config.example`: a `kerghan.env` created by an older client has no default user, and `kerghan update-env` adds it.

## Files to Change
- `standalone/bin/kerghan` — the notice and hint text in `cmd_up`.
- `standalone/config.example` — the `auto-login` comment.
