# bats tests

Cover every "Required tests" item in `files.md`, `configure.md` and `security.md`, using the
existing harness (`load helpers/setup`: temporary `HOME`, `vault` / `docker` / `openssl` stubs,
`STUB_LOG`, `write_env_file`, `write_legacy_env_file`, `write_config`, `assert_output_contains`,
`refute_logged_prefix`).

- Split by spec file, so each suite maps to one "Required tests" list:
  `configure_files.bats` (routing, missing files, existing content, values, writing, change list,
  apply hint), `configure.bats` (usage errors, list, single read, write, `KEY=-`, `--unset`,
  refused keys) and `configure_security.bats` (masking, inline-secret hint, `--force`, cross-key
  warnings, password note, file safety, Docker footprint).
- Add small helpers to `helpers/setup.bash` only when shared by several suites (e.g. a file mode
  reader that works on both GNU and BSD `stat`, or `refute_output_contains` as in
  `install_setup.bash`).
- Drive the TTY paths with `KERGHAN_ASSUME_TTY=true` and stdin input; drive `KEY=-` from a pipe
  with `printf`.
- **Failed write test.** CI runs as root, so a read-only directory does not fail the write.
  Simulate the failure after the temp file is created instead, e.g. with an `mv` stub in
  `standalone/test/stubs/` that fails when an env var is set (put it on `PATH` only in that
  test), then assert the original file is byte for byte unchanged and no temp file is left in
  the directory.
- "No Docker / vault call" tests: assert with `refute_logged_prefix "docker"` and
  `refute_logged_prefix "vault"` when `kerghan.env` exists.
- Run the whole suite (`docker-compose run --rm standalone_tests`), not only the new files, to
  confirm existing commands are unchanged.

## Files to Change
- `standalone/test/configure_files.bats` — new, `files.md` required tests.
- `standalone/test/configure.bats` — new, `configure.md` required tests.
- `standalone/test/configure_security.bats` — new, `security.md` required tests.
- `standalone/test/helpers/setup.bash` — shared helpers, only if needed.
- `standalone/test/stubs/mv` — new, failing-`mv` stub for the failed write test (if that
  approach is used).
