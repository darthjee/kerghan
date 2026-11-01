# command.md: `kerghan update [VERSION]`

Write `docs/agents/specs/client-update/command.md`:

- **Usage synopsis (exact, copied verbatim by #417):** e.g. `update [VERSION] [--force] [--yes] [--restart | --no-restart]`, with the one-line description in the `usage` command list, plus an option block for `update` like the one `up` has.
- **Flags:**
  - `--force` reinstalls the same version.
  - `--yes` skips the downgrade confirmation; it is accepted with no effect on an upgrade or a no-op.
  - `--restart` / `--no-restart` override `restart-on-update`; giving both is a usage error.
  - Unknown options are usage errors.
- **Flow:**
  1. Validate and resolve the version (link to `versions.md`).
  2. Compare (link to `versions.md`).
  3. Install: run the downloaded installer with the explicit environment (link to `contracts.md`). An installer failure (Docker unreachable, install dir not writable) is passed on with its error plus a hint, and nothing changes.
  4. Hand off (link to `contracts.md`). If the `exec` fails, error out with the `kerghan up` hint.
  5. Finish, in the new client:
     - Add missing `kerghan.env` keys with the `update-env` logic, skipped when `kerghan.env` does not exist.
     - Pull the image for the configured variant (online / `-offline`; the config wins, as with `up`), with progress shown. A configured `image-tag` is kept and pulled, with a warning that it still overrides the pinned version.
     - Restart according to the override or the setting, only when the instance is running, through `up`'s logic (including the non-release running image case).
     - Print the `updated X -> Y` line and the `docker image rm <previous image>` hint.
- **Instance state and failures:**
  - Not running: no restart, and print the `kerghan up` hint.
  - Pull fails: no rollback; report it and suggest `kerghan update --force` or `kerghan up`.
  - Restart fails (e.g. a port conflict): no rollback; report it with `up`'s existing hints.
  - Concurrent runs are out of scope.
- Exact messages (using the client's `error:` / `warning:` / `hint:` prefixes) and exit codes for every path.
- **Required tests:** the usage synopsis; flag parsing and the conflicting-flags error; the full flow with stubbed `curl`, installer, `vault` and Docker; each restart mode × running/stopped; the `image-tag` override; the offline variant; installer, exec, pull and restart failures; the env step skipped when the file is missing.

## Files to Change
- `docs/agents/specs/client-update/command.md` — new.
