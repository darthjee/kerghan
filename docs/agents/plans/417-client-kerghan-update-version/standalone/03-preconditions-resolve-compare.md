# Preconditions, resolution and comparison (old client)

Implement steps 0–2 of command.md's flow in `cmd_update`, per versions.md and security.md.

**Preconditions** (before any download, each refusal exit 1, nothing changed):
- `load_config`.
- Resolve the running client's real file from `BASH_SOURCE[0]` with `resolve_symlink`, then
  canonicalize its directory with `(cd -P "$(dirname "$real")" && pwd -P)`. Refuse when the
  basename is not `kerghan` (the `not a file named 'kerghan'` error + reinstall hint) or the
  path cannot be resolved.
- Refuse when the directory is not writable (`<dir> is not writable` + the `never uses sudo`
  hint).

**Resolve:**
- Create the staging folder with `mktemp -d`; set an `EXIT`/`INT`/`TERM` trap removing it (Ctrl-C
  exits 130).
- Download `releases/latest/download/install.sh` (no `VERSION`) or
  `releases/download/<v>/install.sh` into the staging folder with one `curl` call that captures
  the HTTP status (`-w '%{http_code}'`, `-o <file>`, `-sSL`, no `-f` so a 404 is distinguishable).
  Map: 404 with `VERSION` → `does not exist` + releases hint; 404 without → `no release found at
  <url>`; any other failure → `could not download <url>` + network hint.
- Read the stamp as text: first line matching `^KERGHAN_VERSION="[0-9]+\.[0-9]+\.[0-9]+"$`
  (`grep -E | head -n 1`); missing → `has no KERGHAN_VERSION="x.y.z" line`; differs from the
  requested `VERSION` → `is for version X, not Y`. Never source the file.

**Compare** with `version_compare` against the client's `KERGHAN_VERSION`:
- current not `x.y.z` → non-release warning, full flow, no confirmation;
- equal, no `--force` → `kerghan <v> is already up to date.`, exit 0 (one curl call, no docker);
- equal + `--force` → `Reinstalling kerghan <v>...`;
- no `VERSION` and latest older → `is newer than the latest release` + downgrade hint, exit 0
  (also with `--force`);
- newer → `Updating kerghan X -> Y...`;
- explicit `VERSION` older → the four downgrade warning lines (+ `--restart is ignored on a
  downgrade` when given), then `--yes` / TTY `[y/N]` prompt on stderr (`y`/`yes` any case runs;
  anything else or EOF → `Downgrade cancelled; nothing was changed.` exit 1) / no TTY without
  `--yes` → error + `--yes` hint, exit 1; then `Downgrading kerghan X -> Y...`.

## Files to Change
- `standalone/bin/kerghan` — `cmd_update` body plus small helpers (e.g. `update_client_dir`,
  `update_download`, `update_stamp_version`, `update_confirm_downgrade`).
