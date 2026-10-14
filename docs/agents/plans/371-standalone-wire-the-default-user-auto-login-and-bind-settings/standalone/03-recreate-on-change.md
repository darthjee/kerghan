# Recreate on a changed auto-login or bind

A changed `auto-login` or `bind` must recreate the running instance on the next `kerghan up`, keeping the data volume, like a port change.

- Add `running_auto_login`: read the running container's env (`docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER"`) and extract `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`. Treat a missing value as `false`, which covers an instance started by an older client, so upgrading to this client recreates it with auto-login on.
- Add `running_bind`: read `.HostIp` from the same `80/tcp` binding as `running_port`. Normalize an empty value to `0.0.0.0`.
- Extend `recreate_reason` (or compute the reason in `cmd_up` once `recreate_reason` returns nothing) so that, with the same image and port, a different auto-login prints e.g. `turning automatic login on` / `off`, and a different bind prints `publishing on <bind>`. Update the comment above `recreate_reason` ("Only the image and the port drive this decision"). The existing `vault_cmd down` and `up_instance` path does the rest, and the volume is untouched.
- Extend the docker stub with `STUB_RUNNING_ENV` (newline-separated) and `STUB_RUNNING_HOST_IP` (default `0.0.0.0` or empty), matching the new inspect formats.
- Tests: an unchanged running instance prints "already running" with no `vault down`. A changed auto-login, a changed bind, and an old instance with no variable each recreate it (`vault down` then `vault up`) without removing `vault-kerghan-data`.

## Files to Change
- `standalone/bin/kerghan` — `running_auto_login`, `running_bind`, recreate logic.
- `standalone/test/stubs/docker` — new inspect formats and env vars.
- `standalone/test/upgrade.bats` (or the new bats files from step 02) — recreation tests.
