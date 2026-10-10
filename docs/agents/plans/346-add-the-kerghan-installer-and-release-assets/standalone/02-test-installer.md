# Test the installer

Add bats tests for `standalone/install.sh` to the existing suite (run by `bats standalone/test`).

- New `standalone/test/install.bats` with its own `setup`. Either make it a separate helper,
  `standalone/test/helpers/install_setup.bash`, or a function in `setup.bash`. It uses the same
  temporary HOME and `STUB_LOG` pattern, but **without** the `vault` stub on PATH by default, so
  "vault missing" is the default case. Build PATH from a stub dir plus a minimal set of real
  tools (bash, coreutils, etc.) so a real `vault`, `curl` or `docker` on the host can never be
  hit.
- New stubs in `standalone/test/stubs/`:
  - `curl`: logs `curl <args>`. It writes the `-o` target according to the URL: a fake
    `kerghan` script (prints its version) for the client URL, and a fake Vault installer for the
    raw Vault URL. The fake Vault installer logs `vault-install VAULT_VERSION=$VAULT_VERSION` and
    writes an executable `vault` into `$HOME/.local/bin`. `STUB_CURL_FAIL_URL=<substring>` makes
    a matching download fail (exit 22). `STUB_VAULT_INSTALL_EXIT` makes the fake Vault
    installer fail.
  - `uname`: prints `${STUB_UNAME:-Linux}`.
  - Extend the existing `docker` stub: `docker info` exits `${STUB_DOCKER_INFO_EXIT:-0}`. The
    current kerghan tests must keep passing.
- Cases (covering every "Required tests" entry in `docs/agents/specs/standalone/installer.md`
  that belongs to the installer):
  - success on Linux and on macOS (`STUB_UNAME=Darwin`): client installed executable to
    `~/.local/bin/kerghan`, the requested URL uses the stamped version;
  - unsupported OS, docker missing from PATH, `docker info` failing, install dir not writable,
    client download failing, Vault installer download failing, Vault installer failing: each
    exits 1 with its message, and `<dir>/kerghan` does not exist afterwards;
  - `KERGHAN_INSTALL_DIR` installs there; the PATH warning (with the `export PATH=` line) shows
    when the dir is not on PATH and is absent when it is;
  - `vault` missing → the Vault installer is fetched from the raw URL at `0.1.0` and run with
    `VAULT_VERSION=0.1.0`; `vault` present (stub on PATH) → no Vault download at all;
  - rerun over an existing `kerghan` replaces it (upgrade in place);
  - `KERGHAN_VERSION=0.4.0` downloads `releases/download/0.4.0/kerghan`;
  - `~/.kerghan` is not created;
  - consistency: the stamped `KERGHAN_VERSION` in `install.sh` equals the one in
    `standalone/bin/kerghan`, and `VAULT_VERSION` equals the tag in `FROM darthjee/vault:<v>` in
    `dockerfiles/kerghan_standalone/Dockerfile`.

## Files to Change

- `standalone/test/install.bats` — new installer tests.
- `standalone/test/helpers/setup.bash` (or a new `helpers/install_setup.bash`) — installer
  harness.
- `standalone/test/stubs/curl`, `standalone/test/stubs/uname` — new stubs.
- `standalone/test/stubs/docker` — `docker info` exit control.
