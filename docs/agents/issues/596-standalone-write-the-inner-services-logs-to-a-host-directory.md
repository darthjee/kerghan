# Issue: Standalone: write the inner services' logs to a host directory

Part of #594. Sub-issue 2 of 3. Independent of the other sub-issues; can run in parallel with sub-issue 1.

**Depends on #606** (drop query strings and `Referer` from the Tent access log). #606 must ship
first, or together with this issue, so the host files never record them.

## Problem

When a standalone instance looks broken, there is no easy way to tell whether a request reached
Kerghan at all. The standalone image is two levels of Docker: host → Vault container
(`vault-kerghan`) → inner compose stack (`standalone/vault/docker-compose.yml`) with `tent`,
`kerghan` and `mysql`. The inner services log to stdout. Vault runs `docker compose up` attached, so
`kerghan logs` (`vault logs`, i.e. `docker logs` on the Vault container) does show them, but:

- **They are mixed with everything else.** The inner `dockerd` output, compose's own messages, and
  every service share one stream, with no timestamps by default. Following one service, or
  correlating a Tent request with the backend line it caused, is hard.
  `kerghan compose logs <service>` separates them, but only while the instance is running.
- **They are lost with the container.** Both `docker logs` on Vault and `compose logs` inside it go
  away when the container is recreated: on `kerghan down`/`reset`, and on the `kerghan up` that
  follows a changed port, bind, variant, image tag or auto-login. That is often exactly when you
  want to look back.
- **They are only reachable through Docker.** There is no file to open, `grep`, or attach to a bug
  report without a running instance.

## Expected Behavior

After `kerghan up` with the defaults, `~/.kerghan/logs/` holds one timestamped, size-rotated file per inner service (`tent`, `kerghan`), owned by the host user (`0700` directory, `0600` files). The files survive container recreation, `kerghan down` and `kerghan reset`. With
#606 in place, the Tent file never records query strings, `Referer`, `Cookie` or `Authorization`.
Docker's own copies of the inner services' logs are bounded. Logging never prevents Kerghan from
starting.

## Solution

Write the inner services' logs, one file per service, to a host directory.

- **Services and files:**
  - `tent`: Apache access and error logs.
  - `kerghan`: backend output. The workers run in the same process and log to the same place, so
    they are included with no separate file.
  - MySQL logs are **out of scope**.
- **Mechanism (chosen): a collector as an inner compose service.** A new `logs` service in
  `standalone/vault/docker-compose.yml`, on a pinned Docker CLI image (e.g. `docker:<ver>-cli`),
  mounts the inner daemon's `/var/run/docker.sock` and `./logs` (which is `/vault/logs` in the Vault
  container, bind-mounted from the host). It follows the `tent` and `kerghan` services' logs with
  timestamps and writes one rotated file per service. `restart: unless-stopped` restarts it if it
  dies. No change to the application images, the Tent image or the Vault image.
  - **File ownership:** the collector runs as root against the inner socket, creates the directory
    and files with `umask 077`, and `chown`s them to the host UID/GID, which the client passes to
    Vault and the stack passes to the `logs` service. This avoids having to give a non-root user
    access to the socket's group.
  - **Offline variant:** the Docker CLI image joins the inner images preloaded as tarballs
    (`bin/release_kerghan_standalone.sh`, `standalone/images/<arch>/`), so the offline image grows
    by that image's size. The online variant pulls it on first start, like the others.
  - How it follows the services (`docker compose -p ... logs` with the project file mounted
    read-only, or `docker logs -f` per container found by the `com.docker.compose.service` label)
    and how it rotates (in its own script, or through a rotating writer) are left to planning.
- **Alternatives rejected:**
  - A collector process inside the Vault container (wrapping Vault's entrypoint with a background
    respawn loop): `darthjee/vault` has no process supervisor or hook for extra processes, so it
    would tie Kerghan to Vault's entrypoint internals and make Kerghan run its own supervisor.
  - An upstream "log to directory" feature in `darthjee/vault`: the cleanest option, but it would
    block this issue on a Vault release. It can be revisited later.
  - Each service writing its own files: changes to the backend and Tent config, and a mount through
    both Docker levels for each service.
  - Exposing the `json-file` driver directory: files named by container id, JSON-encoded.
  - Only extending `kerghan logs`: the logs are still lost with the container.
- Also set the `json-file` driver `max-size`/`max-file` on the inner services so Docker's own copy is
  bounded.
- **Host directory: two new config keys** that follow the existing conventions in
  `standalone/config.example` (kebab-case keys, `true | false` booleans, and an empty value always
  means the default, so an empty value cannot mean "off"):

  ```text
  # Write the inner services' logs (tent, kerghan) to files on the host: true | false.
  #file-logs=true
  # Host directory for those files. Absolute or starting with ~/. Empty: ~/.kerghan/logs.
  #log-dir=
  ```

  - `file-logs=false` keeps any `log-dir` value set, so turning logs back on needs no retyping.
  - A relative `log-dir` is invalid, with the standard error (line number, instance untouched).
  - A changed `file-logs` or `log-dir` joins the settings that recreate the instance on the next
    `kerghan up` (see Backward compatibility).
  - **Shared contract:** the later `kerghan diagnose` sub-issue reads both keys. When `file-logs` is
    true, the logs are in the resolved `log-dir`.
  - Add both keys to `config.example`, `configure`, the wizard (advanced) and the help text.
  - Rejected: a single `log-dir=` key with an `off` sentinel. It would be the only key where a magic
    word replaces a path, and a directory named `off` would become ambiguous.
- **Rotation:** size-based, fixed at 10 MB × 5 files per service. It is not configurable in this
  issue; keys can be added later without breaking anything.
- **Timestamps:** every line is timestamped (`compose logs -t`) so files can be correlated across
  services.

## Security

- **Tent access log: handled by #606.** The stock Tent image logs Apache's `combined` format to
  stdout, with full query strings (which can carry the OAuth / GitHub App `code` and `state`, and
  password-reset `token`s) and the `Referer`. #606 replaces that with a read-only Apache conf
  override that logs `%U` (the path only) and drops `Referer`. It is a separate issue because the
  exposure exists today, in `kerghan logs`, independent of file logs. This issue relies on it: the
  collector writes Tent's stdout as it is and does no redaction of its own.
- Backend logs are exposed as they are (the same output is already visible through
  `kerghan compose logs`), but the existing rule that credentials are never logged (#295, GitHub
  tokens) now also protects files on disk. Request a `security` agent review.
- **Permissions:** directory `0700`, files `0600`, owned by the host user. On Linux, files written as
  root inside Vault would show up root-owned on the bind mount: the client passes the host UID/GID
  to Vault, and the collector `chown`s the directory and each file it creates to that UID/GID
  (Docker Desktop on macOS maps ownership itself, but the same rule applies).
- **Inner docker socket:** the `logs` service mounts the inner daemon's socket, which gives it root
  on the *inner* daemon. That stays inside the Vault boundary, which is already privileged or
  Sysbox, and is the only service with the socket. The `security` review should confirm this.

## Edge cases

- Container restarted or recreated → the collector reattaches and keeps appending to the same file.
- Collector dies → its `restart: unless-stopped` policy restarts it; only that gap is lost, Kerghan
  keeps running. Kerghan does not depend on the `logs` service, so it never waits on the collector.
- Log directory missing → created. Not writable → warning on `kerghan up`, start without file logs.
  Disabled → no mount. Kerghan never fails to start because of logging.
- `kerghan down` and `kerghan reset` both keep the logs (host files outside the data volume); the
  docs say how to delete them.

## Backward compatibility

- The log mount needs the container recreated: the log setting joins the settings that recreate the
  instance on the next `kerghan up` (the data volume is kept), like a changed port.
- An older client only warns about the new unknown keys, so a downgrade still works.
- A newer client with an older image (via `image-tag`) that has no collector: the mount stays empty;
  the client does not fail, at most it notes that file logs need a newer image.

## Performance

One `compose logs -f` stream appending to files: negligible. Disk is bounded by rotation and, for
the inner services, by `json-file` `max-size`. The outer Vault container's log stays unbounded until
darthjee/vault#81 ships (see Out of scope).

## Out of scope

- MySQL logs.
- Changing what the backend logs (content, format, levels).
- Shipping logs to external services, metrics or monitoring stacks.
- Changing `kerghan logs`.
- Non-standalone deployments (Render, the development docker-compose).
- The Tent access-log format: #606.
- Bounding the outer Vault container's own log (`vault-kerghan`). `vault up` has no `--log-opt`
  option today, so it waits on darthjee/vault#81. A later Kerghan issue adopts it once Vault ships
  it. Until then, users can bound it through Docker's `daemon.json` `log-opts`, and the docs say so.

## Testing

bats tests for the client (mount args, UID/GID, the `file-logs` and `log-dir` keys including the relative-path error and
`file-logs=false` meaning no mount, recreate trigger, unwritable directory),
and the standalone smoke test (`standalone/scripts/smoke_test.sh`) checks that a request shows up in
the Tent access log file on the host, and a backend line in the `kerghan` file, both timestamped
(the query-string check lives in #606's smoke test). The files must be owned by the host
user with `0600`, and the `logs` service must come back after it is killed
(`kerghan compose kill logs`).

## Agent

standalone (`standalone/`, `dockerfiles/kerghan_standalone/Dockerfile`, the new `logs` service),
plus infra if the offline tarball list in
`bin/release_kerghan_standalone.sh` changes, plus a `security` review.
