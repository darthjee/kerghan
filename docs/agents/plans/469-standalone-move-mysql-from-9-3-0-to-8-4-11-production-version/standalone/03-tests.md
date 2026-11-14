# bats tests

Add `standalone/test/mysql_migration.bats`, extending `standalone/test/stubs/docker` and `stubs/vault` so they can simulate each case (the old volume present and populated, present but empty, or absent, plus a failure at each step). Cover:
- **Fresh install:** no migration calls and no `mysql-legacy` start.
- **Old data present:** the steps run in order (stop kerghan → start legacy → dump → drop/create + restore → start kerghan → verify → volume rm), and the success message is printed.
- **A failure at each step** (legacy start, dump, restore, health, count mismatch): exits non-zero, never calls `volume rm`, and prints the error and hint.
- **Retry after a failure:** migrates and removes the old volume.
- **Already-running instance:** `kerghan up` still migrates.
- **`kerghan update` with a restart:** migrates through `update_restart` → `cmd_up` (extend `update.bats`/`upgrade.bats`).
- **No password** appears in any recorded stub command line or in the output.
- **Downgrade below this release:** prints the "cannot be read" hint.

The whole suite must also pass under bash 3.2. That means no associative arrays and no `${var,,}`.

## Files to Change
- `standalone/test/mysql_migration.bats` — new.
- `standalone/test/stubs/docker`, `standalone/test/stubs/vault` — scenario controls.
- `standalone/test/update.bats`, `standalone/test/upgrade.bats` — the update-path cases.
- `standalone/test/helpers/setup.bash` — shared scenario helpers, if needed.
