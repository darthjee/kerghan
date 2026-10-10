# Script skeleton, argument parsing and vault mapping

Create `standalone/bin/kerghan`, bash 3.2 compatible: no associative arrays, no `${var,,}`, no
`mapfile`/`readarray`, no `[[ -v ]]`, and no `local -n`. Use `set -euo pipefail` with care for
bash 3.2's `set -u` and empty arrays (use `${arr[@]+"${arr[@]}"}`).

Structure it as small functions, with `main "$@"` at the bottom guarded by
`[ "${BASH_SOURCE[0]}" = "$0" ]`, so the bats tests can `source` the script and call functions
directly.

- **Constants:** `KERGHAN_VERSION="0.5.0"` (column 0, see the shared contract), and
  `IMAGE_REPO=darthjee/kerghan-standalone`, `INSTANCE=kerghan`, `VOLUME=vault-kerghan-data`,
  `CONTAINER=vault-kerghan`, `DEFAULT_PORT=3000`.
- **Paths:** `KERGHAN_HOME="${HOME}/.kerghan"` and `ENV_FILE="$KERGHAN_HOME/kerghan.env"`.
  Tests override `HOME`.
- **Dispatch:**
  - `up`, `down`, `logs`, `status`, `compose`, `reset`, `version`, `help` (also `-h` and
    `--help`).
  - Anything else prints the usage to stderr and exits 2, matching Vault's usage-error exit
    code.
  - With no command, print the usage and exit 2.
- **`up` flags:** `--offline`, `-p PORT` / `--port PORT`, and `-f`. Validate `PORT` as an
  integer from 1 to 65535. An unknown flag prints the usage and exits 2.
- **`logs` flags:** only `-f`. **`compose`:** every remaining argument is passed through
  verbatim.
- **Image:** `image_ref` returns `$IMAGE_REPO:$KERGHAN_VERSION`, plus `-offline` with
  `--offline`.
- **`vault_cmd`:** runs `vault "$@" --name kerghan` from `$KERGHAN_HOME` in a subshell, so a
  stray `.vaultrc` is not picked up (see the plan notes). `up` adds
  `--image <ref> --env-file "$ENV_FILE" -p <port>:80`, plus `-e FRONTEND_BASE_URL=...` when
  needed (step 02), plus `-f` when given.
- **Simple commands:**
  - `down`: `vault down --name kerghan`.
  - `logs [-f]`: `vault logs --name kerghan [-f]`.
  - `status`: `vault status --name kerghan`.
  - `compose <args>`: `vault compose --name kerghan <args>`.
  - `version`: `kerghan <KERGHAN_VERSION>`.
- **`reset`:** prompt `This deletes all Kerghan data (vault-kerghan-data). Continue? [y/N]` on
  stderr, and read from stdin. Only `y` / `yes` (any case, through `tr`) proceeds. It then runs
  `vault down --name kerghan` and `docker volume rm vault-kerghan-data`, ignoring a missing
  volume, and prints a summary. It leaves `kerghan.env` alone. A decline prints `Aborted.` and
  exits 0.
- **Errors:** the prefixes `kerghan: error:`, `kerghan: warning:` and `kerghan: hint:` on
  stderr, like Vault.
- **Header comment:** explain the purpose and the dependencies (`vault`, `docker`, `openssl`),
  the bash 3.2 constraint, and that the version is pinned by `scripts/bump_version.sh`.

## Files to Change
- `standalone/bin/kerghan` — new: the client script (skeleton, parsing, simple commands, `reset`)
