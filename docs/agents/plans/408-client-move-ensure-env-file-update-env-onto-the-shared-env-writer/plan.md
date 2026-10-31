# Plan: Client: move ensure_env_file / update-env onto the shared env writer

Issue: [408-client-move-ensure-env-file-update-env-onto-the-shared-env-writer.md](../../issues/408-client-move-ensure-env-file-update-env-onto-the-shared-env-writer.md)

## Overview
`ensure_env_file` and `cmd_update_env` in `standalone/bin/kerghan` stop writing `kerghan.env`
with their own redirects and go through the #404 `write_file_atomic` (mode `600`), so the file is
written through one code path. Behavior on success is unchanged apart from the new inode; tests
are added for the symlink and failed-write cases only, and the docs drop the "inode is kept" promise.

See [standalone.md](standalone.md) for the full plan.
