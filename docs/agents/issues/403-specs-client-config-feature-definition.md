# Issue: Specs: client config feature definition

## Description

First sub-issue of the client config Epic (#402). Write the feature specs for two new `kerghan`
client commands, `kerghan configure` (set values directly) and `kerghan wizard` (interactive),
which read and write both `~/.kerghan/config` and `~/.kerghan/kerghan.env`, following the
lifecycle in `docs/agents/specs.md` (precedent: the user approval specs, #390).

Feature summary (full context and every decision in #402):

- Both files are in scope. Config keys are lower-case (`port`, `variant`, `runtime`,
  `stop-timeout`, `image-tag`, `auto-login`, `bind`), env keys upper-case, so the key alone
  decides which file is written.
- The commands only write the files and print `key: old -> new` plus the apply hint; they
  never run `kerghan up`.
- `configure`: list (`kerghan configure`), single read (`configure port`), atomic multi-key set
  (`configure port=3002 auto-login=false`), `--unset`, `--show-secrets`, `--force` for the two
  secrets, and `KEY=-` to read a value with hidden input / from stdin.
- `wizard`: one question per key with the current value in brackets (Enter keeps it),
  `auto-login` before `bind`, advanced keys only with `--advanced`, password keep / generate /
  type, summary + confirmation, never asks for the secrets, fails without a TTY.
- Edge cases (missing files, invalid / duplicate / commented-out lines, unknown keys, empty
  values, `--unset` of generated env keys, permissions, atomic writes, symlinks, cross-key
  warnings, abort) and the security rules (masking, `=-`, `--force` confirmation, password
  change effects) are listed below, in "Decisions by spec file".

### Scope

In scope:

- The five files under `docs/agents/specs/client-config/`.
- The "Active specs" entry in `docs/agents/specs.md`.
- The exact `usage` synopsis lines of both commands, in `configure.md` and `wizard.md` (e.g.
  `configure [--show-secrets] [--force] [--unset KEY] [KEY[=VALUE|=-]...]`), which the
  implementation sub-issues copy verbatim into the client `usage`.

Out of scope:

- Any code, including `standalone/bin/kerghan` and its `usage` (the `configure` and `wizard`
  sub-issues of #402).
- `standalone/config.example`, `docs/agents/standalone.md` and the root `README.md` (the fold
  sub-issue of #402).
- `CLAUDE.md` / `AGENTS.md`: only the specs hub links to feature folders.

If writing the specs shows that a decision above conflicts with the client's current behavior
(e.g. a validator that accepts a character the decision assumes it rejects), adjust the
decision in the spec and call it out in the PR description — do not stop to ask.

## Problem

The two commands share a writer for both files and a set of rules (key routing, validation,
masking, output formats, edge cases) that span two implementation sub-issues. Without one
agreed definition, the `configure` and `wizard` sub-issues would each make their own decisions
and drift apart.

## Expected Behavior

- `docs/agents/specs/client-config/` exists with `README.md`, `files.md`, `configure.md`,
  `wizard.md` and `security.md`, each (except the README index) ending with a
  "Required tests" section.
- The feature is listed under "Active specs" in `docs/agents/specs.md`.
- Every decision in #402 is captured in the spec file that owns it, so the implementation
  sub-issues can build against the specs without re-deciding anything.
- No code changes.

## Solution

- **`README.md`** — overview, purpose, scope (both files; write-only, never runs `up`),
  product decision #402, index of the other files.
- **`files.md`** — the two files and their key namespaces, how each is read (config parser
  rules; env literal values as Docker reads them), the write rules (in-place line replacement,
  append, uncommenting a `#key=` template line, duplicate handling), missing-file behavior
  (create; create `kerghan.env` as `up` does; refuse when the data volume exists), invalid
  lines, unknown keys, value rules (no newlines, no empty values), `--unset` restrictions,
  permissions, temp-file + rename, symlinks.
- **`configure.md`** — syntax, listing format (value + source), single read, atomic multi-key
  set, `--unset`, `--show-secrets`, `--force`, `KEY=-`, refused client-managed keys, output and
  apply hint.
- **`wizard.md`** — question list and order, bracket defaults, re-ask on invalid input,
  `--advanced`, password options, summary + confirmation, abort writes nothing, no-TTY failure.
- **`security.md`** — masking (list, single read, change summary), secret handling and the
  `--force` confirmation, `=-` hint, temp-file umask, auto-login/bind and missing-credentials
  warnings, password change effects on the next boot.

### Open decisions settled

Decisions not covered by #402, to be captured in the specs:

1. **`KERGHAN_DEFAULT_USER_ENABLED` / `_ADMIN` in the wizard** — asked only with `--advanced`.
   When auto-login is off and `ENABLED=false`, nothing uses the default user, so the wizard
   skips the username / email / password questions. No conflict check: automatic login
   implies an enabled default user (`ALWAYS_AUTHENTICATED` implies enabled, see
   `docs/agents/modules/auth/default-user.md`). Owner: `wizard.md`.
2. **`FRONTEND_BASE_URL` and custom env variables** — `--advanced` also asks
   `Public URL [http://localhost:<port>, derived from port]`; Enter keeps the current value
   (nothing is written when it was never set). Any other custom env variable is handled by
   `configure` only. Owner: `wizard.md`.
3. **Exit codes and streams** (following the client's conventions) — owner: `README.md`
   (shared by both commands):

   | Case | Exit |
   |------|------|
   | Success | `0` |
   | Wizard summary answered "n" (prints `Nothing written.`) | `0` |
   | Usage error (unknown option, malformed argument, `--unset` without a key) — prints usage | `2` |
   | Refusal (invalid value, refused / unknown key, missing `kerghan.env` with a data volume, no TTY, declined `--force` confirmation) | `1` |
   | Ctrl-C | `130` |

   Values, the change list and the apply hint go to stdout; errors, warnings and hints go to
   stderr through the existing `error` / `warn` / `hint` helpers.
4. **Listing format** — owner: `configure.md`:

   ```
   config (~/.kerghan/config)
     port          3001        file
     bind          127.0.0.1   derived (auto-login on)
     runtime       sysbox      file, invalid
   env (~/.kerghan/kerghan.env)
     KERGHAN_DEFAULT_USER_PASSWORD   ********   file
     FRONTEND_BASE_URL               —          not set
   ```

   Sources: `file`, `default`, `derived (...)`, `not set`, plus `, invalid` for an invalid file
   value. No `--json`: scripts use the single read (`kerghan configure <key>`), which prints the
   raw value only (an empty line and exit 0 when unset).
5. **Apply hint per key** — owner: `files.md` (shared by both commands):

   | Keys changed | Hint |
   |--------------|------|
   | `port`, `variant`, `image-tag`, `auto-login`, `bind` | Run `kerghan up` to apply (recreates the instance; data is kept). |
   | `runtime`, `stop-timeout` | Run `kerghan down && kerghan up` to apply. |
   | Any env key | Run `kerghan down && kerghan up` to apply (same as `update-env`). |

   When several keys change, only the strongest hint is printed (`down && up` covers
   everything). A password change adds the note that the admin's sessions are revoked on the
   next boot.

### Decisions by spec file

Every decision from the Epic (#402), grouped by the spec file that owns it, so this issue can be
worked without the Epic open. Existing behavior the specs build on: `load_config` lets the last
line win for a repeated key, fails on a malformed line or invalid value with the line number,
and only warns on an unknown key; `kerghan.env` is read by Docker's env-file parser (literal
values, no quoting, `#` is part of the value); `kerghan.env` is the source of truth for the
default user (the backend overwrites its email, password and admin flag on every boot, and a
password change revokes its sessions).

#### `README.md`

- Two commands, `kerghan configure` (direct) and `kerghan wizard` (interactive), over both
  `~/.kerghan/config` (lower-case keys: `port`, `variant`, `runtime`, `stop-timeout`,
  `image-tag`, `auto-login`, `bind`) and `~/.kerghan/kerghan.env` (upper-case keys).
- The key alone decides the file (namespaces never collide): no `--env` flag.
- They only write the files and print what changed plus the apply hint; they never run `up`.
- Exit codes and streams (see "Open decisions settled", 3).
- Product decision: #402. Alternatives rejected: git-config style (`configure port 3002`) in
  favour of atomic multi-key `key=value`; an `--env` flag; commands that also run `up`; a
  wizard-only design (`configure` is scriptable and shares the writer).

#### `files.md`

Missing files:

1. No `config` — listing shows defaults; the first write creates the file.
2. No `kerghan.env`, no data volume — create it as `up` does (`ensure_env_file`: generated
   secrets + default user), then apply the change.
3. No `kerghan.env`, data volume exists — refuse with the `update-env` hint (restore from the
   backup, or `kerghan reset`).

Existing content:

4. Invalid line in `config` — listing marks it `invalid`; setting / unsetting that key fixes
   it; changing another key while it stays invalid is refused (`up` would still fail).
5. Duplicate key — setting rewrites the last (effective) line and removes earlier copies, with
   a warning; `--unset` removes every copy.
6. Commented-out key (`#port=3000`) — with no active line, the first such template line is
   uncommented (its explanation stays above it); otherwise the key is appended. `kerghan.env`
   keys are always appended.
7. Unknown lower-case key — refused as a likely typo. Any upper-case env key is accepted; only
   known ones are validated (with the client's `valid_*` validators for config keys).

Values and writing:

8. Values with a newline are rejected; config values cannot contain `#`; env values are
   written exactly as given.
9. Empty values (`port=`) are rejected; `--unset` returns to the default.
10. `--unset` of a generated env key (`DEFAULT_ENV_KEYS`) is refused.
11. A written existing key keeps its line position; comments and unrelated lines are kept.
    `kerghan.env` stays mode 600, `config` keeps its mode. Writes go to a temp file in the same
    directory (created under a restrictive umask) and are renamed into place. A symlinked file
    is written through to its target, keeping the link.
- The apply hint per key (see "Open decisions settled", 5).

#### `configure.md`

- `kerghan configure` — list every value (format in "Open decisions settled", 4).
- `kerghan configure <key>` — print the raw value (masked for a secret unless
  `--show-secrets`; empty line when unset).
- `kerghan configure key=value [key=value...]` — validate all, write all or nothing, print
  `key: old -> new` per change, then the apply hint.
- `kerghan configure --unset <key>` — remove the key's lines.
- `--show-secrets` — unmask in listing and single reads.
- `KEY=-` — read the value with hidden input from the TTY, or from stdin when piped; works for
  any key.
- `--force` — required for `KERGHAN_SECRET_KEY` / `KERGHAN_INTEGRATIONS_KEY`.
- Refused: `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, `KERGHAN_DEFAULT_USER_ALLOWED_IPS`
  (client-managed; same hint as `up`).

#### `wizard.md`

- Questions in order: port, variant, auto-login, bind (its default depends on auto-login),
  default user username, email, password. `--advanced` adds `runtime`, `stop-timeout`,
  `image-tag`, `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN` and the public URL
  (see "Open decisions settled", 1–2).
- Current value (or default) in brackets; Enter keeps it; an invalid answer re-asks. An invalid
  current value is shown as invalid and the default is offered.
- Password: (k)eep, (g)enerate (same generator as `up`, never printed; says it is in
  `kerghan.env`), (t)ype (hidden, asked twice, re-asked on mismatch).
- Never asks for the secrets.
- Summary of changes, then `[Y/n]`; nothing is written before the confirmation.
- 13. Ctrl-C or end of input before the confirmation writes nothing.
- 14. A running instance needs no special handling; the apply hint is printed.
- Without a TTY: fail and point to `kerghan configure`.

#### `security.md`

- Masking: the default user password and the two secrets show as `******** (set)` in the
  listing and single reads unless `--show-secrets`; changes to them print `<KEY>: changed`,
  never `old -> new`.
- Inline secrets: `KEY=value` keeps working for a secret key but prints a hint pointing to
  `KEY=-` (shell history, `ps`).
- `--force` on the two secrets: warns that changing them logs everyone out and makes stored
  integration credentials unreadable (back up `kerghan.env`), and asks `[y/N]` on a TTY;
  without a TTY `--force` alone is enough.
- 12. `auto-login=true` with a non-loopback `bind` is written with the same warning `up`
  prints; `auto-login=true` without default-user credentials is written with a warning that
  `up` will fail (not when the same call sets username, email and password).
- Password change: the apply hint notes the admin password changes and its sessions are
  revoked on the next boot.
- The `kerghan.env` temp file is mode 600 before the rename.
- Performance: neither command starts or inspects containers; the only Docker call is the
  read-only volume check of `files.md` case 3.

### Testing strategy

Each spec file (except the `README.md` index) ends with a "Required tests" section: one line
per scenario, phrased so it maps directly to one bats test in `standalone/test/` for the
implementation sub-issues. This issue itself adds no tests (no code changes).

### Backward compatibility

None affected: docs only. The specs require the commands to leave existing commands, flags
and file formats unchanged.
