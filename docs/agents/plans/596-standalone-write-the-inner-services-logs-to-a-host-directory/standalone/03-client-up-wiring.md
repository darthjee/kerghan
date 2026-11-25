# Client: wire the log directory into `kerghan up`

In `standalone/bin/kerghan`:

## Effective file-logs state

Add a helper, e.g. `prepare_log_dir`, called by `cmd_up` before the recreate check:

- If `file-logs` is `false`, the effective state is off.
- Otherwise, `mkdir -p` the resolved directory, then `chmod 700` it. If either fails, or a write
  probe fails (`mktemp "$dir/.probe.XXXXXX"` and then `rm`), print
  `warn "log directory <dir> is not writable; starting without file logs"` and treat the state as
  off. **Never fail `up` because of logging.**
- The result goes in globals, e.g. `EFFECTIVE_FILE_LOGS=true|false` and `EFFECTIVE_LOG_DIR`.

## `vault up` arguments

In `up_instance` (:2017-2055), between the client-managed `-e` values (:2024-2026) and
`--runtime/--stop-timeout` (:2027), add:

```text
-e KERGHAN_FILE_LOGS=<effective> -e KERGHAN_HOST_UID=$(id -u) -e KERGHAN_HOST_GID=$(id -g)
[-v <EFFECTIVE_LOG_DIR>:/vault/logs]     # only when effective is true
```

Add `KERGHAN_FILE_LOGS`, `KERGHAN_HOST_UID` and `KERGHAN_HOST_GID` to `CLIENT_MANAGED_KEYS`
(:724), so `refuse_client_managed_keys` and `batch_validate` reject them in `kerghan.env`.

## Recreate trigger

Extend `settings_reason` (:656-672) and its call (:1879):

- Add `running_file_logs`, which reads `KERGHAN_FILE_LOGS` from `.Config.Env`, like
  `running_auto_login` (:612-628). A missing value means `false`, because an instance created by
  an older client has no collector env.
- Add `running_log_dir`, which reads the `/vault/logs` mount source:
  `docker inspect --format '{{range .Mounts}}{{if eq .Destination "/vault/logs"}}{{.Source}}{{end}}{{end}}'`.
  Empty means no mount.
- Recreate when the effective state differs, or when it is on and the mount source differs from
  `EFFECTIVE_LOG_DIR`. Messages follow the existing style, e.g.
  `file logs changed (off -> on); recreating…` and `log directory changed (<a> -> <b>); recreating…`.
- The UID/GID are not compared. They only change if another user runs the client, and that is out
  of scope.

## Older image hint

Add `FIRST_FILE_LOGS_VERSION="<the release that ships this>"` next to `FIRST_UPDATE_VERSION`
(:45-49). When file logs are effectively on and the wanted image tag is semver and older
(`version_compare`), print one `hint` that file logs need image >= that version, and continue. A
non-semver tag gets no hint.

## Files to Change

- `standalone/bin/kerghan`: `prepare_log_dir`, `up_instance` args, `CLIENT_MANAGED_KEYS`,
  `running_file_logs`, `running_log_dir`, `settings_reason`, `FIRST_FILE_LOGS_VERSION` and the
  hint.
