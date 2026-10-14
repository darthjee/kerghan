# Shared default-key list

Refactor `ensure_env_file` so that the keys it writes, and how each value is produced, come from one place that `update-env` also uses. For example:

- `DEFAULT_ENV_KEYS`, a plain string or array in write order: `KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN`.
- `default_env_value <key>`, a `case` that prints the value: `openssl rand -base64 32` for the two secrets, `openssl rand -hex 24` for the password, and the fixed values for the rest.

`ensure_env_file` then loops over the list. Its output must stay byte-for-byte the same: the same order, the same `openssl` calls in the same order (the stub counter in `secrets.bats` relies on this: the password is the third value), mode 600 under `umask 077`, and the same message. Update the function comment. The list must never contain `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` or `KERGHAN_DEFAULT_USER_ALLOWED_IPS`.

## Files to Change
- `standalone/bin/kerghan` — the default-key list, `default_env_value`, and `ensure_env_file` rewritten to use them.
