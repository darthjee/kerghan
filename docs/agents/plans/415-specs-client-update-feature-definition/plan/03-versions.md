# versions.md: validation, resolution and comparison

Write `docs/agents/specs/client-update/versions.md`:

- **`VERSION` validation:** strict `x.y.z`, with an optional leading `v` stripped. Anything else is rejected before any download (with the exact error message). Explain why: the value goes into a URL and an environment variable.
- **Resolution through the installer stamp line:**
  - Without `VERSION`, download `https://github.com/darthjee/kerghan/releases/latest/download/install.sh`.
  - With `VERSION`, download `https://github.com/darthjee/kerghan/releases/download/<v>/install.sh`.
  - Read the `KERGHAN_VERSION="x.y.z"` stamp line. A failed download means the version does not exist (or the network is down); a missing or malformed stamp line is an error; a stamp that does not match the requested `VERSION` is an error. Nothing changes in any of these cases.
  - The same downloaded file is the one run in the install step (cross-link to `command.md` and `security.md`). No GitHub API and no credentials.
- **Comparison against the current `KERGHAN_VERSION`:**
  - Target equal to the current version (plain `update` or an explicit `VERSION`): print "already up to date" (exact message) and exit 0. `--force` reinstalls.
  - Latest older than the current version on a plain `update`: print `kerghan X is newer than the latest release Y` and do nothing. A downgrade only happens with an explicit `VERSION`.
  - Explicit older `VERSION`: a downgrade. Show the warning (older versions may carry fixed vulnerabilities, and the `restart-on-update` key becomes unknown to versions older than it), then the `[y/N]` confirmation. `--yes` skips it; without a TTY and without `--yes`, refuse. `--force` does not change this.
  - Current client not a release (`KERGHAN_VERSION` is not semver): warn and update without the no-op or downgrade logic, mirroring `up`'s non-release-image handling.
- **Downgrade below `FIRST_UPDATE_VERSION`:** define the constant as "the first release that contains `update`" (no number; #417 sets it). When the target is older, replace the client only: skip the handoff (no env update, no pull, no restart) and print `run 'kerghan up' to switch the instance to <v>`. The warning and confirmation still apply.
- Exact messages and exit codes for every case.
- **Required tests:** each validation case; resolution with a stubbed download (latest, explicit, 404, missing, malformed and mismatched stamp); each comparison branch, including the TTY / no-TTY / `--yes` downgrade matrix; the non-release current client; the below-`FIRST_UPDATE_VERSION` path.

## Files to Change
- `docs/agents/specs/client-update/versions.md` — new.
