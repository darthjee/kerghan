# Add the port_listeners helper

Add a reusable function to `standalone/bin/kerghan` that lists the processes listening on a TCP port on this host. It's the shared contract #597 (`kerghan diagnose`) will reuse, so it has no `up`-specific logic: it reports and does not decide.

**Contract** (document it in a comment above the function):

- `port_listeners <port>` prints one line per listener: `<address><TAB><process>`. `<process>` is empty when it is unknown.
  - Duplicate `address`/`process` pairs are printed once.
  - Addresses are printed as the tool reports them, e.g. `*:5000`, `127.0.0.1:5000`, `[::1]:5000`.
- Exit status:
  - `0`: a tool ran. No output means no listener.
  - `2`: skipped, because neither `lsof` nor `ss` is available. Nothing is printed.

**Detection:**

1. `lsof` first: `lsof +c 0 -nP -iTCP:<port> -sTCP:LISTEN -F cn`.
   - `+c 0` gives full command names, so `ControlCenter` and not `ControlCe`.
   - Parse the field output: a `c<command>` line sets the current process, and each following `n<address>` line is one listener.
   - `lsof` exits 1 when nothing matches. Treat that as "no listener" (exit 0, no output), not as a failure.
2. Otherwise `ss`: `ss -Hltnp "sport = :<port>"`.
   - The local address is column 4.
   - The process name is the first `"name"` inside `users:((...))`. It may be missing when not running as root; print an empty process then.
3. Neither tool on `PATH` (`command -v`) → return 2.

Keep it bash 3.2-compatible: no `mapfile`, no associative arrays, no `${var,,}`. Deduplicate with `sort -u`, or with a plain string check.

**Test harness:**

- Add `standalone/test/stubs/lsof` and `standalone/test/stubs/ss`.
  - Each logs its call to `STUB_LOG`, like the other stubs.
  - Each prints a canned listing from an env var (`STUB_LSOF_OUTPUT` / `STUB_SS_OUTPUT`, written in the tool's own format), and exits with `STUB_LSOF_EXIT` / `STUB_SS_EXIT`.
  - With no output set, `lsof` exits 1 (no match) and `ss` prints nothing.
- In `helpers/setup.bash`, always copy both stubs into `STUB_BIN`, and add the new variables to the `unset` list. Tests must never reach the host's real `lsof`/`ss`.
- For the "neither tool" case, a test needs a `PATH` without either stub. Add a small helper to `setup.bash` (e.g. `hide_listener_tools`) that removes both stubs from `STUB_BIN`.
  - Real `lsof`/`ss` outside `STUB_BIN` must not be found either. The helper can point `PATH` at `STUB_BIN` plus a minimal directory of symlinks to the tools the client needs. Pick whatever is simplest, as long as the test proves the client never finds a real tool.

**Tests:** a new `standalone/test/port_listeners.bats`. The helper isn't a CLI command, so test it through its effects in step 02, or source the client with a guard if the file already supports that. Check how other helpers are tested and follow that. Cover:

- `lsof` output with ControlCenter on `*:5000` (IPv4 and IPv6) → two lines with `ControlCenter`.
- The `lsof` no-match exit 1 → no output, exit 0.
- `lsof` missing and `ss` present → the `ss` fallback, with and without a `users:` column.
- Neither tool → exit 2, no output.

## Files to Change

- `standalone/bin/kerghan`: new `port_listeners` function.
- `standalone/test/stubs/lsof`: new stub.
- `standalone/test/stubs/ss`: new stub.
- `standalone/test/helpers/setup.bash`: copy the stubs, unset their variables, add the hide-tools helper.
- `standalone/test/port_listeners.bats`: new tests (or fold them into step 02's file if the helper is only reachable through `up`).
