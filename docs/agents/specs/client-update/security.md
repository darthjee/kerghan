# Security

How `kerghan update` downloads and runs code safely. Built by #417. Overview:
[README.md](README.md).

## Trust model

`update` trusts exactly what the first install trusts: the GitHub release of
`darthjee/kerghan`, fetched over HTTPS. The first install runs
`curl -fsSL …/releases/latest/download/install.sh | bash`; `update` downloads the same file (or a
given version's) and runs it.

- **No checksum verification.** `SHA256SUMS` comes from the same release, so it only catches
  corruption in transit, not a compromised release; HTTPS already covers transit. Real
  protection needs signatures, a possible future hardening issue, out of scope here.
- **HTTPS only.** The client fetches with `curl -fsSL --proto '=https' --proto-redir '=https'`,
  so neither the URL nor a redirect (the `releases/latest` and asset redirects) can fall back to
  plain HTTP.
- The installer it runs then downloads the client from the same release, with the same trust.

## Download to a file

The installer is **never piped into bash**:

- it is downloaded to a file in the staging folder, with `curl -f`, so an HTTP error is a failure
  and not an error page saved as a script;
- a failed, empty or stamp-less download is detected before anything runs (see
  [versions.md](versions.md#resolution-through-the-installer-stamp-line));
- it is run as `bash <file>`, never sourced into the client, and the stamp is read as text,
  never evaluated.

## Temp files

- One staging folder per run, created with `mktemp -d` (private, unpredictable name, under
  `TMPDIR`). Nothing is written to a shared or predictable path.
- An `EXIT` trap (also covering `INT` and `TERM`) removes it on every failure path and on
  Ctrl-C (exit `130`).
- **Before the `exec` of the handoff the folder is removed explicitly**, because `exec` replaces
  the process and no trap runs. The below-`FIRST_UPDATE_VERSION` path, which does not `exec`,
  relies on the trap.
- The installer uses its own staging folder, which it cleans up itself.

## Strict `VERSION`

`VERSION` is validated as strict `x.y.z` (one optional leading `v` stripped) before it is used
anywhere (see [versions.md](versions.md#version-validation)). Only digits and dots reach the URL
and the `KERGHAN_VERSION` variable, so values such as `../`, `?`, `#`, `%2e`, spaces or newlines
can never change the URL or inject anything into the installer's environment. The stamp read from
the downloaded file is held to the same rule.

## Exact-path execution

- **Real path.** The client resolves its own file (`BASH_SOURCE[0]`) through the existing
  `resolve_symlink` helper, then canonicalizes its directory with
  `(cd -P "$(dirname "$real")" && pwd -P)`, since `resolve_symlink` keeps relative parts (a
  relative link target, or a relative `BASH_SOURCE[0]` under `bash kerghan`). It so a client run through a symlink (e.g. `/usr/local/bin/kerghan`
  pointing at `~/.local/bin/kerghan`) updates the file actually in use, and the symlink keeps
  pointing at it.
- **`KERGHAN_INSTALL_DIR`** is the directory of that real file.
- **File name.** The installer always writes `<install dir>/kerghan`. When the real file has
  another name (e.g. a symlink to `kerghan-0.9.0`), updating would write a different file than
  the one in use, so `update` refuses before downloading:

  ```
  kerghan: error: this client runs from /opt/kerghan/kerghan-0.9.0, not a file named 'kerghan'
  kerghan: hint: reinstall with KERGHAN_INSTALL_DIR=<dir> and the installer (curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash)
  ```

  Exit `1`. A path that cannot be resolved (a symlink loop) fails the same way, with
  `resolve_symlink`'s error.
- **Handoff.** The `exec` targets exactly `<install dir>/kerghan`, never a `PATH` lookup, so
  another `kerghan` earlier on `PATH` is never run (see
  [contracts.md](contracts.md#handoff-interface)).
- **Handoff variables** are set and unset explicitly, and validated by the new client before use
  (see [contracts.md](contracts.md#environment)).

## No sudo, no credentials

- `update` never uses sudo and never asks for privileges. A non-writable install dir is refused
  before anything is downloaded (see [command.md](command.md#0-preconditions)), and the
  installer's own check covers a race.
- No GitHub API, no token, no credentials: the release redirects need none, so the unauthenticated
  API rate limit (60 requests per hour) never applies.
- No new network destination: only `github.com` (and its release asset host, through
  redirects) and the Docker registry the pull already uses.

## Secrets

- `update` never prints a `kerghan.env` value, on any path.
- The env step uses the `update-env` logic: it only appends missing keys, keeps every existing
  value byte for byte, keeps the file at mode `600`, and writes atomically through
  `write_file_atomic` (a failed write leaves the file unchanged). It prints the names of added
  keys only, and the existing pointer to where the admin password lives when it generated one.
- Secrets never travel through the handoff: the new client reads `kerghan.env` itself.

## Downgrade risk

Older versions may carry vulnerabilities that later releases fixed. The downgrade warning says
so, and the downgrade needs the `[y/N]` confirmation or an explicit `--yes` (see
[versions.md](versions.md#downgrade)). A downgrade never recreates a running instance on its own,
so a newer instance's data is never opened by an older image without the user running
`kerghan down && kerghan up`.

## Required tests

In `standalone/test/update.bats`:

- **No secrets in the output:** a full update with a `kerghan.env` holding known secret values,
  including one where the env step adds keys, never prints any of those values on stdout or
  stderr.
- **Temp files:** the staging folder is removed after a successful update (before the `exec`),
  after each failure (download, stamp, installer, declined downgrade) and on `INT`.
- **Never piped:** the installer is run as `"$BASH" <file>` (no `bash` stub on `PATH`, which would
  also catch the client's own shebang); the served stub installer records its `$0` (a file in
  the staging folder) and that its stdin is not the script. `curl` is called with `-f` and the
  HTTPS-only options.
- **`VERSION` metacharacters:** `../0.9.0`, `0.9.0?x`, `0.9.0#x`, `0.9.0%2e`, `0.9.0 x` and a value
  with a newline are rejected with exit `2` before any `curl` call.
- **Symlinked client:** run through a symlink (absolute and relative targets), the installer
  receives the target's canonical directory as `KERGHAN_INSTALL_DIR`, the `exec` targets the real file, and the symlink is left in place.
- **Other file name:** a client whose real file is not named `kerghan` is refused with exit `1`
  before any download.
- **`PATH` shadowing:** with another `kerghan` first on `PATH`, the handoff still runs the
  installed file.
- **Env permissions:** after the env step adds keys, `kerghan.env` keeps mode `600` and its
  existing lines unchanged.
