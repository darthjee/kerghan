# Shared helpers

Add the small helpers that `cmd_diagnose` (step 02) and `cmd_up` share or need. All of them are
bash 3.2-safe (no associative arrays, no `mapfile`, no `${var,,}`) and are documented with a
contract comment, like `port_listeners`.

- **`advertised_url <bind> <port>`**: prints the URL `kerghan up` advertises. Today it is
  `http://localhost:<port>`, whatever the bind. Replace the two hard-coded `echo` lines in `cmd_up`
  (`Kerghan is running at ...`, `Kerghan is already running at ...`) with it, so #598 changes one
  place and diagnose always matches `up`.
- **`published_probe_host <bind>`**: `127.0.0.1` for `0.0.0.0` (or an empty `HostIp`), otherwise
  the bind itself (E4, E5).
- **`with_timeout <seconds> <cmd...>`**: runs the command through `timeout` when it is on `PATH`,
  otherwise runs it unbounded. Used for `docker info`, `docker inspect` and `vault compose ps`.
- **`probe_http <url>`**: one hardened request:
  `curl -q -s -o <body file> -D <headers file> -w '%{http_code}' --connect-timeout 2 --max-time 3 --noproxy '*' --proto '=http,https' <url>`.
  No `-L`, no cookies, no auth. It writes the body and headers to `mktemp` files (cleaned up with a
  trap) and returns, through variables or stdout lines, the status code (or `timeout` for exit 28,
  `refused` for exit 7, `error` otherwise), the `Server` header and the body.
- **`sanitize_header <value>`**: strips control characters (`tr -d '\000-\037\177'`) and cuts to
  100 characters. Every `Server` value goes through it before printing.
- **`display_path <path>`**: prints `~/...` when the path is under `$HOME`, otherwise the path as
  is.
- **`is_docker_process <name>`**: true for the known Docker listener names (`com.docker.*`,
  `docker-proxy`, `vpnkit`, `OrbStack`, `rootlesskit`, `gvproxy`, `limactl`).
- **`docker_host_label`**: for a remote `DOCKER_HOST` (`tcp://`, `ssh://`), prints only the scheme
  and host (no user info, port optional), for the `[skip]` line.

## Files to Change

- `standalone/bin/kerghan`: the helpers above; `cmd_up` uses `advertised_url` for its two URL
  messages (the output is unchanged).
