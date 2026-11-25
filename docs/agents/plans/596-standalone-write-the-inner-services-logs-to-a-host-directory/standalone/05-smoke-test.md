# Smoke test

`standalone/scripts/smoke_test.sh` runs the image with `docker run -d --privileged` directly
(:136-140), not through the client. Extend it as follows:

- Create a temp host directory (`mktemp -d`) and pass
  `-v <tmp>:/vault/logs -e KERGHAN_FILE_LOGS=true -e KERGHAN_HOST_UID=$(id -u) -e KERGHAN_HOST_GID=$(id -g)`.
  Remove the directory in `cleanup()` (:49-56). The files belong to the host user, so plain `rm`
  works.
- **Offline check** (`check_offline`, :88-102): add the `LOGS_IMAGE` value to the
  expected-preloaded images. Read it from the image's `/vault/.env`
  (`docker exec <c> cat /vault/.env`) so it always matches the Dockerfile.
- **After `wait_for_200` and the frontend check:** wait up to about 10 s for `<tmp>/tent.log` and
  `<tmp>/kerghan.log` to exist. Then assert:
  - `tent.log` contains the request path the smoke test just made;
  - every line starts with an RFC 3339 timestamp;
  - `kerghan.log` is non-empty;
  - both files are mode `600` and owned by the current UID, and the directory is mode `700`
    (`stat -c`, with a `stat -f` fallback on macOS).
- **Collector restart:** run `docker exec <c> docker compose exec logs pkill -f collect.sh` (or
  `kill` the script's PID). With `init: true` the script is not PID 1, so the container exits
  non-zero and `restart: unless-stopped` brings it back. Do **not** use `docker compose kill`:
  Docker treats that as a manual stop and does not restart. Then make another request and assert
  its path is appended to `tent.log` within about 10 s.
- **After the existing `docker restart` step:** assert `tent.log` still contains the
  pre-restart line, so the file is appended to and not truncated.
- Update the header comment (:19-23) for the preloaded images and the new checks.

Query-string absence is #606's smoke check, not this one.

## Files to Change

- `standalone/scripts/smoke_test.sh`: the mount and env, the offline image list, the log-file
  checks, the collector restart check, cleanup, and the header.
