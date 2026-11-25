# Warn on a port conflict in kerghan up

In `cmd_up`, right before the `up_instance` call (after the "already running" early return and after `vault down` on a recreate), call a new `warn_port_conflict <bind> <port>`. It never changes the exit status and never stops `up`.

**Skip conditions** (silent, no output):

- `DOCKER_HOST` is set and starts with `tcp://` or `ssh://`: a remote engine, so host listeners say nothing about where it publishes. Unset, empty, or `unix://...` → run the check.
- `port_listeners` returns 2 (no tool).
- No listener.

**Output**, when one or more listeners are found (all on stderr, with the existing `warn`/`hint` helpers):

```
kerghan: warning: port 5000 is already in use by ControlCenter (*:5000, [::]:5000)
kerghan: warning: Kerghan is published on 127.0.0.1:5000 only; other addresses (such as localhost) may reach that process instead
kerghan: hint: use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port
```

- **First line:** the distinct process names joined with `, `, each followed by its addresses in parentheses. When the process is unknown (e.g. `ss` without root), write `another process` instead of the name.
- **Second line:** uses the effective `<bind>:<port>`.
- **AirPlay hint:** when a listener's process is `ControlCenter` and the port is `5000` or `7000`, add one more hint after the first one:
  `kerghan: hint: on macOS this is the AirPlay Receiver; turn it off in System Settings > General > AirDrop & Handoff, or pick another port`
  Use `>` rather than `→` so the output stays ASCII.
- **Same address:** when the listener holds the bind address itself, Docker fails right after and the existing `up_instance` hint follows. The warning comes first; there's no special case.
- Also runs in foreground mode (`-f`): the call sits before `up_instance`, which handles both modes.

**Tests:** a new `standalone/test/port_conflict.bats`, using the stubs from step 01:

- ControlCenter on `*:5000` with `-p 5000` → both warnings, the `-p` hint, the AirPlay hint, and `up` still starts (the vault stub logs `up`, and the exit status is 0).
- The same listener on port 3000 → no AirPlay hint.
- An unknown process (the `ss` stub without `users:`) → `another process`.
- No listener → no warning.
- Neither tool → no warning, `up` starts.
- `DOCKER_HOST=tcp://remote:2376` → no warning, and the stubs log no `lsof`/`ss` call. `DOCKER_HOST=unix:///var/run/docker.sock` → the check runs.
- Already running with the same settings → no `lsof`/`ss` call.
- A recreate (e.g. a port change) → the check runs before the new `vault up`.
- `-f` → the check runs.
- `--bind 0.0.0.0` → the second line says `0.0.0.0:<port>`.
- The existing `port.bats` tests still pass unchanged.

## Files to Change

- `standalone/bin/kerghan`: new `warn_port_conflict`, and its call in `cmd_up` before `up_instance`.
- `standalone/test/port_conflict.bats`: new tests.
