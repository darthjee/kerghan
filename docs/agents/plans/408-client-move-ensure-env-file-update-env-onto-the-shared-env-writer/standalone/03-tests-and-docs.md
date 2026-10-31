# Tests and docs
Add bats tests only for the newly gained behavior, following the patterns in
`standalone/test/configure_files.bats` ("a failed write leaves the original file untouched and no
temp file" with the `stubs/mv` + `STUB_MV_FAIL=1` stub, and "a symlinked config is written
through…"):

- `update_env.bats`: a symlinked `kerghan.env` gets the missing keys in its target and stays a
  symlink (target mode 600, no stray temp file); a failed write (`mv` stub) exits non-zero with
  `could not write`, leaves the file identical (`cmp`) and no temp file in `~/.kerghan`.
- `secrets.bats` (or `install.bats`, wherever `up` creating `kerghan.env` is covered): a dangling
  symlink `kerghan.env` is created at its target by `up` and stays a symlink, mode 600; a failed
  write leaves no `kerghan.env` and no temp file, and `up` exits 1 before starting anything.

Existing suites must pass unchanged.

Docs:
- `docs/agents/standalone.md`, `update-env` section: replace "Existing content, order, inode and
  mode 600 are kept" with existing content and order kept, mode 600, written atomically (temp file
  + rename, through symlinks) so the inode changes. Mention that `up`'s generated `kerghan.env` is
  written the same way.
- `docs/agents/standalone/client-config.md`, "Writing": note that `ensure_env_file` (`up`) and
  `update-env` use the same atomic writer and rules.

## Files to Change
- `standalone/test/update_env.bats` — symlink and failed-write tests.
- `standalone/test/secrets.bats` (or `install.bats`) — symlink and failed-write tests for `up`.
- `docs/agents/standalone.md` — `update-env` section.
- `docs/agents/standalone/client-config.md` — Writing section.
