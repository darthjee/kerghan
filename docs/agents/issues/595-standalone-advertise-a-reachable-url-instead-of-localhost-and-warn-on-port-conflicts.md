# Issue: Standalone: warn on port conflicts on kerghan up and document the macOS AirPlay port clash

## Description

Part of #594 (sub-issue 1 of 3). This is the quick fix, and it ships first. When another process already holds Kerghan's port, `kerghan up` warns about it, and the standalone docs explain the macOS AirPlay port clash. The URL change itself (whether `localhost` or `127.0.0.1` is advertised) moved to #598, because it needs a manual verification first. #597 (`kerghan diagnose`) reuses the listener-detection helper defined here.

## Problem

The `kerghan` client publishes the port on an IPv4 address only (`bind`, default `127.0.0.1` with
auto-login), but tells the user to use `localhost`:

- `kerghan up` prints `Kerghan is running at http://localhost:<port>` (and `already running at ...`).
- The help text (`usage`) and `standalone/config.example` say `http://localhost:<port>`.
- The default public URL is derived as `http://localhost:<port>` (`frontend_base_url_args`), and the
  wizard shows it as the default.

`localhost` resolves to `::1` first on macOS (and on many Linux hosts), where Docker does not
listen, so the request reaches whatever else holds the port. Observed on macOS with port 5000:

```
$ curl -si localhost:5000
HTTP/1.1 403 Forbidden
Server: AirTunes/935.7.1          <- macOS AirPlay Receiver

$ curl -si http://127.0.0.1:5000
HTTP/1.1 200 OK
Server: Apache/2.4.68 (Debian)    <- Kerghan (Tent)

$ lsof -nP -iTCP:5000 -sTCP:LISTEN
ControlCe  ...  IPv4  TCP *:5000 (LISTEN)
ControlCe  ...  IPv6  TCP *:5000 (LISTEN)
com.docke  ...  IPv4  TCP 127.0.0.1:5000 (LISTEN)
```

The Docker bind succeeds because the addresses differ, so nothing warns the user.

## Expected Behavior

- When another process already listens on the chosen port, `kerghan up` warns before starting, names the process when it can, says where Kerghan is published, and hints how to pick another port. It is a warning, never a failure.
- On macOS, when the AirPlay Receiver is the cause, the warning names the System Settings toggle.
- The standalone docs explain the AirPlay clash on ports 5000/7000, and how to tell whether a response comes from Kerghan.

## Solution

1. **Warn on a port conflict on `kerghan up`**: when another process already listens on the port,
   print a warning naming the process when known, and a hint to pick another port
   (`kerghan up -p <port>` / `port=` in `~/.kerghan/config`). Full design in
   [Port conflict check](#port-conflict-check-design).
   - This listener-detection helper (`lsof`, falling back to `ss`) is a **shared contract**: #597
     (`kerghan diagnose`) reuses it. Keep it a separate, testable function.
2. **Docs**: in the standalone docs, a macOS note that the AirPlay Receiver listens on ports 5000
   and 7000 (System Settings → General → AirDrop & Handoff → AirPlay Receiver), and how to tell
   whether a response comes from Kerghan (the `Server` header). Until #598 lands, the note also says
   that `localhost` can reach the other process while Kerghan is published on IPv4 only.

### Port conflict check (design)

1. **When it runs:** just before a **new** container is created (first `up`, or a recreate after
   `vault down`, which frees the port), in foreground mode (`-f`) too. Skipped on the "already
   running" path. Because it only runs before Kerghan holds the port, **any listener found belongs
   to another process**, so there is no need to recognise Docker's own listener (`com.docker`,
   `docker-proxy`, `vpnkit`, Colima's `limactl`/`ssh`).
2. **Trigger:** any existing listener on the port, whatever its address (simple, and it catches
   AirPlay, which also listens on `*:5000` IPv4 while Docker's `127.0.0.1` bind still succeeds).
   When the listener blocks the bind address itself, Docker fails right after with the existing
   hint; the warning just comes first.
3. **Shared helper:** `port_listeners <port>` prints one `address<TAB>process` line per listener,
   using `lsof -nP -iTCP:<port> -sTCP:LISTEN`, falling back to `ss -Hltnp "sport = :<port>"`. With
   neither available it prints nothing and returns a distinct "skipped" status, so #597
   (`kerghan diagnose`) can report "skipped" rather than "free". With `ss` the process name may be
   missing without root: the address alone is shown. #597 reuses this helper as is and does its own
   filtering of Docker's processes.
4. **Output (warning, never a failure):**

   ```
   kerghan: warning: port 5000 is already in use by ControlCenter (*:5000, [::]:5000)
   kerghan: warning: Kerghan is published on 127.0.0.1:5000 only; other addresses (such as localhost) may reach that process instead
   kerghan: hint: use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port
   ```

   - The second line describes the current IPv4-only publish; #598 updates it if it changes how
     Kerghan is published.
   - **macOS AirPlay hint:** when the process is ControlCenter on port 5000 or 7000, add a hint that
     it is the AirPlay Receiver and can be turned off in System Settings → General → AirDrop &
     Handoff.
5. **Remote Docker:** when `DOCKER_HOST` points to a remote engine (`tcp://`, `ssh://`), the check is
   skipped: host listeners say nothing about where that engine publishes the port. Local `unix://`
   sockets and Docker contexts such as Colima's still run it.

### Edge cases

- Port held on the same address → Docker already fails and the existing hint applies; the warning
  just comes first.
- Linux: no AirPlay, but the same IPv4/IPv6 mismatch can happen with any service; the check runs on
  every OS. Only the docs note and the AirPlay hint are macOS-specific.
- No `lsof`/`ss`, or a remote `DOCKER_HOST` → the conflict check is skipped (no warning).
- Instance already running → no check (Kerghan itself holds the port).

### Backward compatibility

Additive: a new warning on `kerghan up`, no new setting, no change to the advertised URL, the
derived `FRONTEND_BASE_URL` or the published addresses.

### Out of scope

- Changing the advertised URL, `FRONTEND_BASE_URL` or the published addresses (#598).
- Logs and the diagnose command (#596, #597).

### Testing

bats tests in `standalone/test/` for the conflict warning: a listener found (stubbed `lsof`), the
`ss` fallback (with and without a process name), neither tool present, remote `DOCKER_HOST`, the
AirPlay hint (ControlCenter on 5000/7000), the already-running path (no check), and the helper's
"skipped" status.

### Agent

standalone (`standalone/bin/kerghan`, `standalone/test/`, standalone docs under
`docs/agents/standalone/`).

## Benefits

- Port conflicts show up as a clear warning when Kerghan starts, rather than as a confusing 403 in the browser.
- It ships quickly, without waiting for the browser and Docker checks that the URL change (#598) needs.
- The listener helper becomes the base for `kerghan diagnose` (#597).
