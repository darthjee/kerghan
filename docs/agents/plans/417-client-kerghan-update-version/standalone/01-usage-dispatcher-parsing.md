# Usage, dispatcher, constants and argument parsing

Wire the command in without any behaviour yet beyond parsing.

- Add `FIRST_UPDATE_VERSION="0.8.3"` near `KERGHAN_VERSION`, with a comment: it is the first
  release that ships `update`; any value above 0.8.2 and not above that release behaves the same
  because no release lies in between, and it must never change once released.
- Add the release URL base (`https://github.com/darthjee/kerghan/releases`) as a constant.
- `usage`: add the `update [VERSION] [--force] [--yes] [--[no-]restart]` entry before
  `update-env` and the `Options for update:` block after `Options for up:`, verbatim from
  command.md. `--finish` is never listed.
- Header comment listing the commands that load the config: add `update`.
- Dispatcher: `update) cmd_update ${@+"$@"} ;;`, separate from `update-env`.
- `cmd_update`: if `$1` is `--finish`, require it to be the only argument (otherwise usage error,
  exit 2) and call `cmd_update_finish`. Otherwise parse options and `VERSION` in any order:
  `--force`, `--yes`, `--restart`, `--no-restart`; a second positional → `only one VERSION can
  be given`; `--restart` + `--no-restart` → `cannot be combined`; any other `-*` →
  `unknown option`; `VERSION` with one leading `v` stripped must pass `is_semver` (and contain
  only digits and dots) or `invalid version '<v>' (expected x.y.z, e.g. 0.9.0)` — all via
  `usage_error` (exit 2) before anything else runs. `--finish` mixed with anything is a usage
  error.

## Files to Change
- `standalone/bin/kerghan` — constants, header comment, `usage`, `main` dispatcher, new
  `cmd_update` (parsing only at this step).
