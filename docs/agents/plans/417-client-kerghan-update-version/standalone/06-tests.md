# `update.bats` and stub extensions

Add `standalone/test/update.bats` covering every "Required tests" section of command.md,
versions.md, contracts.md and security.md (usage, parsing, validation, preconditions,
resolution, no-op, newer-than-latest, non-release client, downgrade matrix and no-restart,
below `FIRST_UPDATE_VERSION`, full upgrade flow, equal image, missing env with volume, restart
matrix incl. `--restart`/`--no-restart`, env step, pull, failures, result and cleanup, handoff
env validation and `--finish` by hand, staging folder removed on every path, no sudo, no env
values printed). Use the existing `helpers/setup.bash` (`CURRENT_VERSION`, `OLDER_VERSION`,
`NEWER_VERSION`, `STUB_LOG`) so a version bump needs no test change, and drive the TTY with
`KERGHAN_ASSUME_TTY=true` and stdin for answers.

Each test runs a **copy** of the client in a temp install dir (so the fake installer can
replace it and symlink/non-writable/name cases can be set up), never the repo file in place.

Stub extensions (additive, documented in each stub's header; existing tests unaffected):
- `stubs/curl`: serve `releases/latest/download/install.sh` and
  `releases/download/<v>/install.sh` as a fake installer stamped `KERGHAN_VERSION="<v>"`
  (latest version via e.g. `STUB_LATEST_VERSION`), honour `-w '%{http_code}'`, and allow forcing
  a 404, a network failure, an empty file, a malformed or mismatched stamp. The fake installer
  logs its `KERGHAN_VERSION`/`KERGHAN_INSTALL_DIR`, can be told to fail, and installs into
  `KERGHAN_INSTALL_DIR/kerghan` a copy of the real client re-pinned to `<v>` (so the handoff
  runs the real `update --finish`), or a non-executable/missing file for the `exec` failure
  cases.
- `stubs/docker`: `pull` (logged, with a `STUB_DOCKER_PULL_EXIT`), and `inspect -f '{{.Id}}'`
  returning a configurable ID (changing after a recreate when needed for the "not recreated"
  hint case).

## Files to Change
- `standalone/test/update.bats` — new suite.
- `standalone/test/stubs/curl` — release `install.sh` URLs, status codes, fake installer.
- `standalone/test/stubs/docker` — `pull` and container ID support.
- `standalone/test/helpers/setup.bash` — only if a shared helper (e.g. installing a client copy)
  is worth sharing; otherwise keep helpers local to `update.bats`.
