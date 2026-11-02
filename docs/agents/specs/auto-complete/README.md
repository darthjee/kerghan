# Auto-complete

Temporary feature specs for **bash tab completion of the `kerghan` client**, delivered by a new
`kerghan completion bash` command and set up by `install.sh`. Product decision: #424.
Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

The `kerghan` client (`standalone/bin/kerghan`) has no shell completion today. Users must
remember its commands, their flags, the keys `configure` accepts and the values those keys
take.

This feature adds bash completion through two channels:

1. **`kerghan completion bash`** prints the completion script on stdout, to be loaded with
   `eval "$(kerghan completion bash)"` (see [command.md](command.md)). The script is built into
   the client, so it always matches the installed version, and `kerghan update` keeps it
   current.
2. **`install.sh`** writes that same output into the user-level bash-completion directory,
   where bash-completion v2 lazy-loads it on the first `kerghan <TAB>` (see
   [install.md](install.md)). No rc-file edit and no sudo.

What the script completes, and what it never completes, is defined in
[completion.md](completion.md).

## Scope

In scope:

- **Shell:** bash only, including bash 3.2 (macOS).
- **What is completed:** command names (and `help` / `-h` / `--help` at the top level), each
  command's flags, `configure` keys (the config keys, the static `DEFAULT_ENV_KEYS` names and
  `FRONTEND_BASE_URL`),
  and the values of the keys with a fixed set: `variant`, `runtime`, `auto-login`,
  `restart-on-update` ([completion.md](completion.md)).
- **`kerghan completion <shell>`**: its shape, streams and error cases
  ([command.md](command.md)).
- **The `install.sh` completion step**: target path, content, hint, non-fatal handling, opt-out,
  overwrite and downgrade ([install.md](install.md)).
- **The stable contracts** the feature creates ([contracts.md](contracts.md)) and its
  performance and security rules ([security.md](security.md)).

Out of scope (from #424):

- zsh and fish (see [Follow-up Epics](#follow-up-epics)).
- Completing `update [VERSION]` with release versions, which would need a network call.
- Passing `compose …` arguments through to docker compose's own completion.
- Completion for the `vault` CLI.
- Dynamic lookups (Docker, Vault, GitHub, config or env files) during completion.
- Windows / PowerShell.
- Uninstalling the completion file: there is no uninstaller; its path is documented in
  [install.md](install.md#target).
- The permanent docs (`docs/agents/standalone.md`, `README.md`, the `install.sh` header),
  including lifting "shell completion" from `standalone.md`'s out-of-scope list: folded in by
  #431.

## Follow-up Epics

- **zsh completion** and **fish completion**: separate Epics, created and handled later. The
  shell is a required argument of `kerghan completion <shell>`, so each can add its shell
  without changing the bash contract (see [contracts.md](contracts.md#kerghan-completion-bash)).

## Decisions summary

- **[command.md](command.md):** `kerghan completion <shell>`, `bash` the only supported shell;
  the script goes to stdout with exit `0`, errors to stderr only with a non-zero exit; no side
  effects.
- **[completion.md](completion.md):** one `_kerghan` function registered for `kerghan` with
  `-o nospace`, adding a trailing space to every candidate except `KEY=`; an exact
  per-position table;
  commands, flags, `configure` keys and fixed values are completed; free-form values,
  versions, passthrough arguments and hidden steps never are; never a fallback to filenames;
  edge cases 1–17 as behaviour; bash 3.2 compatible; config keys, env keys and fixed values
  generated from the client's constants, commands and flags hand-written, all guarded by sync
  tests.
- **[install.md](install.md):** `install.sh` writes the output of the just-installed client into
  `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`
  through a temp file and `mv -f`; prints a `hint:` without `bash-completion`; never fatal;
  opt out with `KERGHAN_COMPLETION=false`; overwrites; a downgrade leaves the file behind.
- **[contracts.md](contracts.md):** `kerghan completion bash`, `_kerghan`,
  `KERGHAN_COMPLETION=false` and the completion file path are stable; the installer's `update`
  contract is unchanged; the sync rule, enforced by the sync tests; the client's constants
  are not contracts.
- **[security.md](security.md):** TAB is pure bash; the emitted script is fixed text and leaves
  the user's shell untouched; no secrets; safe installer writes; the exact binary.

## Sub-issue map

| Issue | Builds | Reads |
|---|---|---|
| #425 | These specs | — |
| #426 | Specs: single source of truth for the completion word lists | [completion.md](completion.md), [contracts.md](contracts.md) |
| #427 | Specs: exact completion matrix and messages | [completion.md](completion.md), [command.md](command.md), [install.md](install.md) |
| #428 | Specs: testing strategy | every "Required tests" section, [Testing](#testing) |
| #434 | Client: completion word-list constants (refactor, no behaviour change) | [completion.md](completion.md#word-lists), [contracts.md](contracts.md#sync-rule) |
| #429 | Client: `kerghan completion bash` | [command.md](command.md), [completion.md](completion.md), [contracts.md](contracts.md), [security.md](security.md) |
| #430 | Installer: completion setup in `install.sh` | [install.md](install.md), [contracts.md](contracts.md), [security.md](security.md) |
| #431 | Fold these specs into the permanent docs and delete this folder | all |

**Order:** #425 → #426 → #427 → #428 → #434 → #429 → #430 → #431. The spec-enhancement
sub-issues edit the same folder, so they go one at a time. #434 changes the client, not this
folder, so it doesn't count toward that rule, but it must merge before #429.

## Open markers

Decisions this folder leaves to later sub-issues are marked in their file as
`> **Open — settled by #NNN:** …`; each sub-issue removes its own markers. No open marker
remains: #428 settled the last one (the test harness and coverage, see [Testing](#testing)), and
#431 checks that none is left.

## Index

| File | Defines |
|---|---|
| [command.md](command.md) | `kerghan completion <shell>`: shape, streams, no side effects, error cases, the exact `usage` line and error messages |
| [completion.md](completion.md) | Registration and the trailing-space rule, what is completed per command, the exact per-position table, what is never completed, edge cases 1–17, bash 3.2 |
| [install.md](install.md) | The `install.sh` completion step: target path, content, hint, bash-completion detection, never fatal, opt-out, overwrite, downgrade, uninstall, exact messages |
| [contracts.md](contracts.md) | Stable contracts: `completion bash`, `_kerghan`, `KERGHAN_COMPLETION`, the file path, the installer's `update` contract, the sync rule |
| [security.md](security.md) | Performance (pure-bash TAB, no side effects, `eval` cost) and security (fixed text, shell hygiene, no secrets, installer writes, exact binary) |

How every rule is tested (harness, bash 3.2 service, file layout, naming) is in
[Testing](#testing) below; each file lists its concrete cases under "Required tests".

**Who reads what:** #434 (client refactor) reads `completion.md` and `contracts.md`; #429
(client, after #434) reads `command.md`, `completion.md`, `contracts.md` and `security.md`;
#430 (installer) reads `install.md`, `contracts.md` and `security.md`; #429 and #430 also read
[Testing](#testing); #431 reads all.

## Testing

Every rule is tested from the "Required tests" section of the file that defines it. This
section describes, once, how those tests are written and run. Settled by #428.

### Harness

Tests drive `_kerghan` directly in the test shell with explicit `COMP_WORDS`. They do not
simulate readline: word splitting depends on the bash version (`COMP_WORDBREAKS`), so a helper
re-implementing it would only test itself.

`standalone/test/helpers/completion.bash`, loaded after `helpers/setup.bash` (reusing its temp
`HOME` and failing stubs), provides:

| Helper | What it does |
|--------|--------------|
| `source_completion` | Writes `"$KERGHAN" completion bash` to `$BATS_TEST_TMPDIR/completion.bash` and sources it into the test shell itself, not through `run`, since `COMPREPLY` is read afterwards. |
| `complete_words LINE -- WORD...` | The core call. Sets `COMP_LINE=LINE`, `COMP_POINT=${#LINE}`, `COMP_WORDS=(WORD...)` and `COMP_CWORD` to the last index, then calls `_kerghan kerghan "$cur" "$prev"` (the three arguments bash passes). |
| `complete_line LINE` | Convenience for lines without `=` or `:`: splits on whitespace only, so a trailing space becomes an empty last word. Fails the test if `LINE` contains `=` or `:`, forcing those cases through `complete_words`. |
| `assert_reply WORD...` | `COMPREPLY` equals the expected words exactly, order-insensitive. Trailing spaces are significant. On failure it prints expected vs actual with each word bracketed (`[up ]`). |
| `assert_no_reply` | `COMPREPLY` is empty. |

- **Cursor at the end:** the cursor is always at the end of the line; mid-line completion is
  not tested.
- **Exact strings:** "no trailing space after `variant=`" is an exact-string assertion
  (`` `variant=` `` vs `` `up ` ``), whatever mechanism the implementation uses.
- **Dual `=` shapes:** every `=` case runs with each shape the spec names.
  `kerghan configure variant=` runs as words `(… variant =)` and as `(… variant = '')`;
  `kerghan configure variant=on` runs as `(… variant = on)`. Together with the bash 3.2 service
  this covers both versions without guessing which split each produces.
- **Registration:** `complete -p kerghan` prints exactly
  `complete -o nospace -F _kerghan kerghan`.

### Fresh-shell tests

Hygiene and safety tests do not run in the bats shell: bats enables `errexit`/`errtrace` and
defines its own functions and variables. They run a fresh `bash --norc --noprofile` with a
small script that:

1. snapshots `set -o`, `shopt`, `IFS`, the `declare -p` names and the `declare -F` names;
2. sources the script and runs a completion;
3. snapshots again and diffs.

The same fresh shell also runs the representative completions with `set -u` on and expects
the same replies and empty stderr. The empty-`PATH` and sentinel-config checks
([security.md](security.md#required-tests)) run there too.

### bash 3.2

The completion tests run under a real bash 3.2, in addition to the existing bash 5 run. No
static lint.

- **Image:** `dockerfiles/bats_bash32/Dockerfile`, `FROM bash:3.2` (official image, bash
  3.2.57, the version macOS ships), with bats-core installed at the suite's pinned version
  (1.11.0).
- **docker-compose:** a new service, `bats_bash32`, next to the existing bats one. It runs
  `standalone/test/completion*.bats` and sets `KERGHAN_TEST_BASH32=1`.
- **CircleCI:** a job running the same glob under that image, alongside the existing
  `bats standalone/test` job. The full suite keeps running on bash 5, so completion is tested
  under both.
- **Guard:** a test in `completion_safety.bats` asserts `BASH_VERSINFO[0] -eq 3`. It is skipped
  unless `KERGHAN_TEST_BASH32=1`, so a base-image change cannot silently turn the service into a
  bash 5 run.
- **Same tests on both versions:** bash 3.2 and 4+ split `COMP_WORDS` differently around `=`,
  so the `=` cases run in both services from the same file. There are no 3.2-only tests.

Rejected:

- **The whole suite under 3.2:** the right long-term goal, but outside this Epic (#433).
- **A static lint for bash-4-only syntax:** redundant once every matrix row runs under 3.2,
  brittle, and prone to false positives.

### File layout

All client completion tests live in `standalone/test/completion*.bats`; the bash 3.2 service
runs exactly that glob.

| File | Holds | bash 5 | bash 3.2 |
|---|---|---|---|
| `completion.bats` | matrix rows, edge cases, registration, dual `=` shapes | ✓ | ✓ |
| `completion_command.bats` | `kerghan completion …` output, errors, exit codes, generator side effects, contracts (`_kerghan`, `complete -o nospace -F _kerghan kg`) | ✓ | ✓ |
| `completion_safety.bats` | hygiene snapshot, empty `PATH`, sentinel config, static deny-list, `BASH_VERSINFO` guard | ✓ | ✓ |
| `completion_sync.bats` | usage cross-check and the single-source-of-truth tests | ✓ | ✓ |
| `install_completion.bats` | installer step: path resolution, opt-out, hint, non-fatal, overwrite, temp file and symlink, not executable, runs the just-installed client; uses `helpers/install_setup.bash` | ✓ | — |

- `install_completion.bats` is kept out of the 3.2 glob (running `install.sh` under 3.2 is
  #433's scope) and keeps `install.bats` from growing.
- The `BASH_VERSINFO` guard is skipped unless `KERGHAN_TEST_BASH32=1`, which the bash 3.2
  service sets.

### Naming and coverage

- **Prefixes:** test names start with the spec label:
  - `@test "matrix <row label>: …"` for each row of the
    [per-position table](completion.md#per-position-table) (labels in its `Label` column);
  - `@test "edge <n>: …"` for each [edge case](completion.md#edge-cases);
  - `@test "contract <name>: …"` for each stable contract in [contracts.md](contracts.md), so a
    failure reads as a user-facing break.
- **Coverage rule:** every table row and every edge case maps to at least one named test (the
  dual `=` shapes count under one label), so coverage is checkable with `grep`. Each "Required
  tests" list cites the same labels; the reviewer of #429 and #430 checks them against the test
  names.
- **No coverage table and no meta-test** parsing the spec files: both would break or decay when
  #431 deletes this folder.
- **No timing tests:** speed is guaranteed structurally by the no-subprocess checks;
  wall-clock assertions would be flaky in CI.

### Out of scope here

This folder only specifies the tests. #429 writes the client tests (`completion*.bats`,
`helpers/completion.bash`) and builds the bash 3.2 image, service and job (infra review as
needed). #430 writes `install_completion.bats` and builds the detection override (see
[install.md](install.md#without-the-bash-completion-package)).
