# Compose pass-through and new kerghan.env values

Let the backend receive the default-user variables, and make new installations generate them.

- In `standalone/vault/docker-compose.yml`, add every `KERGHAN_DEFAULT_USER_*` variable to the `kerghan` service's optional pass-through list (name only, under a short comment): `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, `KERGHAN_DEFAULT_USER_USERNAME`, `KERGHAN_DEFAULT_USER_EMAIL`, `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_DEFAULT_USER_ADMIN`, `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION`. Check whether `KERGHAN_TRUSTED_PROXY_HOPS` is passed today. Add it only if step 05 shows it is needed.
- In `ensure_env_file` (`standalone/bin/kerghan`), also write, after the two secrets:
  - `KERGHAN_DEFAULT_USER_ENABLED=true`
  - `KERGHAN_DEFAULT_USER_USERNAME=admin`
  - `KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local`
  - `KERGHAN_DEFAULT_USER_PASSWORD=<generated>`
  - `KERGHAN_DEFAULT_USER_ADMIN=true`

  Generate the password with `openssl rand -hex 24` (48 characters, no `+/=`, so it is easy to type when auto-login is off and safe in an env file). It passes the backend rule (`PASSWORD_MIN_LENGTH = 8`, `backend/src/auth/password-rules.ts`). Keep the umask 077 and `chmod 600`. Do not write `ALWAYS_AUTHENTICATED` or `ALLOWED_IPS` here, because the client passes them on every `up` (step 02). Update the "Generated secrets" message to mention that the file also holds the `admin` password for manual login.
- Tests (`standalone/test/secrets.bats`): a new `kerghan.env` contains the five values, the password comes from a third `openssl rand` call and is 32+ characters (adjust the `openssl` stub so `rand -hex 24` returns a realistic 48-character value, or assert on the call and the line), the file mode is 600, and an existing file is left untouched.

## Files to Change
- `standalone/vault/docker-compose.yml` — pass-through for the `KERGHAN_DEFAULT_USER_*` variables.
- `standalone/bin/kerghan` — `ensure_env_file` writes the default-user values.
- `standalone/test/stubs/openssl` — realistic output for `rand -hex`, if needed.
- `standalone/test/secrets.bats` — new env-file assertions.
