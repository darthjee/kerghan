# bats tests

Add `standalone/test/config.bats` (plus a `write_config` helper in `helpers/setup.bash` that writes
`$HOME/.kerghan/config` from its arguments) and update existing suites where the `vault` call lines
change (`--runtime auto --stop-timeout 60` now always present on `up`, `--stop-timeout 60` on `down`).

Cover:
- Defaults with no config file (`-p 3000:80`, online image, `--runtime auto`, `--stop-timeout 60`).
- Each key from the file, and flag over file: `-p` over `port=`; `--offline` over `variant=online`;
  `variant=offline` without the flag.
- Comments (whole-line and trailing), blank lines, surrounding whitespace, empty values → default,
  file without a trailing newline.
- Errors with `config:<line>` in the message and no state-changing stub call: line without `=`,
  `port=abc`, `port=70000`, `variant=foo`, `runtime=docker`, `stop-timeout=0` / `-5` / `abc`,
  invalid `image-tag`; also no `kerghan.env` generated.
- Unknown key: warning naming line and key; command proceeds.
- `runtime` / `stop-timeout` reach `vault up`, `vault down`, the recreate `down`, and `reset`.
- `version` / `help` still work with a malformed config.
- `image-tag`: semver tag (online and offline image refs; upgrade vs. downgrade against it),
  non-semver tag (`latest`: no-op when the same image and port run, recreate otherwise).
- Recreation not triggered by a `runtime` / `stop-timeout` change alone.
- Port-in-use hint mentions `port=` in `~/.kerghan/config`.

Run with `docker-compose run --rm standalone_tests`.

## Files to Change
- `standalone/test/config.bats` — new suite.
- `standalone/test/helpers/setup.bash` — `write_config` helper.
- `standalone/test/*.bats` — expected `vault` lines now include `--runtime` / `--stop-timeout`.
