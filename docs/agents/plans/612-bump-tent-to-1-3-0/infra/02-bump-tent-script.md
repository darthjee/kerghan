# bump_tent.sh with --check, and its bats suite

Create `scripts/bump_tent.sh`, the owner of every synced Tent copy (contracts 2–3), and test it.

- Usage: `scripts/bump_tent.sh <X.Y.Z>` writes `tent=<X.Y.Z>` into `version` (replacing the existing line, or failing if none exists), then rewrites each synced copy in the explicit file list; `scripts/bump_tent.sh --check` rewrites nothing, reads `version`, and exits non-zero listing every `file:line` whose synced copy differs (and exits non-zero with an explicit message when `version` has no `tent=` line).
- Validation: no argument, an empty argument or a non-`X.Y.Z` argument exits non-zero with a format error **before** touching any file (mirrors `bump_vault.sh`). Downgrades are accepted; re-running with the current version is idempotent (same bytes, exit 0).
- Matching: `darthjee/tent(-test)?:X.Y.Z` followed by end of line, whitespace or a backtick; never `:latest`, never suffixed tags.
- Portable in-place edits: temp file + `mv`, no `sed -i ''` (see infra Notes). Root from `git rev-parse --show-toplevel`, overridable for tests (e.g. `ROOT` env var) so the bats suite can run against a fixture tree.
- `.claude/scripts/check_proxy.sh`: build its `darthjee/tent:<version>` reference from `version` with the canonical lookup instead of the stale literal `0.10.1`.
- New `scripts/test/bump_tent.bats` (runs in `scripts_tests` as-is): a temp fixture tree holding a `version` file and copies of each listed file shape (compose service lines, CircleCI `- image:` lines, markdown table cells with backticks), plus a `darthjee/tent:latest` line, a `darthjee/tent:9.9.9-arm64` line and a `security.md` with a pin. Cover: rewrite of every copy for both `tent` and `tent-test`; `version` updated; untouched `:latest`, suffixed tag and `security.md`; empty and malformed arguments refused with no file changed; idempotency; `--check` passing on a consistent tree, failing and naming the file on a drifted copy, failing on a missing `tent=` line.

## Files to Change

- `scripts/bump_tent.sh` — new.
- `scripts/test/bump_tent.bats` — new.
- `.claude/scripts/check_proxy.sh` — read the Tent version from `version`.
