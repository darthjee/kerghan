# Client: decide, pass and recreate on the cookie setting

In `standalone/bin/kerghan`, following the auto-login pattern.

1. **`effective_frontend_base_url <port>`** prints the `FRONTEND_BASE_URL` value from `kerghan.env`
   when that file sets it. Otherwise it prints the derived default from `frontend_base_url_args`.
   Reuse the existing parsing (`env_file_sets` / `read_env_file`) rather than a new parser.
2. **`wanted_cookie_secure <bind> <port>`** prints `false` when `is_loopback "$bind"` and the
   effective URL does not start with `https://`. Otherwise it prints `true`.
3. **`running_cookie_secure`** works like `running_auto_login`. It reads `KERGHAN_COOKIE_SECURE`
   from the container's `Config.Env`:
   - A missing value prints `true`: an instance created by an older client had `Secure` cookies.
   - A failed inspect prints `unknown`, which never matches, so the instance is always recreated.
4. **Extend `settings_reason`** with `<current cookie-secure> <wanted cookie-secure>`, checked after
   auto-login and bind:
   - a change to `false` prints `allowing login over plain HTTP on loopback`;
   - a change to `true` prints `requiring HTTPS for the session cookies`.

   Update its caller in `cmd_up` and its comment.
5. **`up_instance`** gains a `cookie_secure` argument and always adds
   `-e KERGHAN_COOKIE_SECURE=$cookie_secure`. Update the function comment that lists the
   always-passed variables.
6. **Make the key client-managed.** Add `KERGHAN_COOKIE_SECURE` to both
   `refuse_client_managed_keys`' list and `CLIENT_MANAGED_KEYS`. Prefer one shared list so they
   cannot drift. Update the refusal hint so it also mentions the TLS route: to keep `Secure`, set an
   `https` `FRONTEND_BASE_URL`.

## Tests (bats)

New file `standalone/test/cookie_secure.bats`, plus updates to `recreate_settings.bats` and
`auto_login.bats` where they assert the exact `vault up` arguments.

- **The passed value:**
  - default loopback bind, no `FRONTEND_BASE_URL` → `false`;
  - `bind=127.0.0.2` → `false`;
  - loopback bind with `FRONTEND_BASE_URL=https://…` in `kerghan.env` → `true`;
  - loopback bind with a user-set `http://…` URL → `false`;
  - `bind=0.0.0.0` → `true`;
  - a LAN IP → `true`.
- **Recreate:**
  - a running instance with no `KERGHAN_COOKIE_SECURE` (older client) and a loopback bind recreates
    with the reason;
  - a matching value does not recreate ("already running");
  - a failed inspect recreates.
- **Refusal:** a `kerghan.env` with `KERGHAN_COOKIE_SECURE=…`, or a bare `KERGHAN_COOKIE_SECURE`
  line, is refused with exit 1 and the hint. The `configure` command refuses to write the key.

## Files to Change

- `standalone/bin/kerghan`: the new helpers, `settings_reason`, `up_instance`, `cmd_up`, and the
  client-managed keys.
- `standalone/test/cookie_secure.bats` (new), `standalone/test/recreate_settings.bats`,
  `standalone/test/auto_login.bats`, `standalone/test/configure.bats` (as needed).
