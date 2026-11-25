# Standalone: client config (`kerghan configure` / `kerghan wizard`)

Part of [Standalone Distribution](../standalone.md). Defines the two client commands that read
and write the standalone settings and secrets, the writer they share, and their security rules.
Product decision: epic #402. Code: `standalone/bin/kerghan` (the "Shared config/env writer"
section, `configure` and the wizard). Tests: `standalone/test/configure_files.bats`,
`configure.bats`, `wizard.bats`, `configure_security.bats`.

## Overview and scope

The standalone settings live in two files under `~/.kerghan/` (see
[Configuration](config-files.md#configuration-kerghan)). Both can be edited by hand, or with:

- **`kerghan configure`**: direct and scriptable. Lists every value, reads one, sets one or more
  (`key=value`), or unsets one.
- **`kerghan wizard`**: interactive. One question per setting, with the current value as the
  default, then a summary and a confirmation before anything is written.

Both use one writer (key routing, validation, line editing, atomic writes) and one set of
secret-handling rules.

- **Both files.** `~/.kerghan/config` holds the client settings, all lower-case keys: `port`,
  `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind`, `restart-on-update`, `file-logs`, `log-dir`.
  `~/.kerghan/kerghan.env` holds the container's environment, all upper-case keys (the two
  secrets, the `KERGHAN_DEFAULT_USER_*` values, `FRONTEND_BASE_URL`, any custom variable).
- **Routing by key.** The two namespaces never collide, so the key alone decides which file is
  written (see [Key routing](client-config/files.md#key-routing)). There is no `--env` flag: the key's case already
  says which file it belongs to.
- **Write-only.** The commands only write the files and print what changed (`key: old -> new`),
  then the [apply hint](client-config/files.md#apply-hint). They never run `kerghan up` and never start, stop or
  inspect containers; the only Docker call is the read-only volume check of
  [Missing files](client-config/files.md#missing-files) case 3. Writing and applying stay separate on purpose: the
  apply hint says which command applies the change.
- **Same files as by hand.** Files written by these commands are read by `up`, `down`, `reset`
  and `update-env` exactly as hand-edited files are.

Out of scope:

- Running or recreating the instance (the user runs the printed apply hint).
- `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, `KERGHAN_DEFAULT_USER_ALLOWED_IPS` and
  `KERGHAN_COOKIE_SECURE`: the client
  manages them itself on every `up` and refuses them in `kerghan.env` (see
  [Refused keys](client-config/configure.md#refused-keys)).
- A machine-readable listing (`--json`): scripts use the single read
  (`kerghan configure <key>`).
- Asking for the two secrets in the wizard.

Design notes:

- **Why `key=value`** rather than a git-config style `kerghan configure port 3002`: several keys
  can be set in one all-or-nothing call.
- **Why a separate `configure`** rather than a wizard-only design: `configure` is scriptable, and
  the wizard is a thin interactive layer over the same writer.

## Exit codes and streams

Shared by both commands, following the client's existing conventions:

| Case | Exit |
|------|------|
| Success | `0` |
| Wizard summary answered `n` (prints `Nothing written.`) | `0` |
| Usage error (unknown option, malformed argument, `--unset` without a key) — prints usage | `2` |
| Refusal (invalid value, refused or unknown key, missing `kerghan.env` with a data volume, no TTY for the wizard, declined `--force` confirmation) | `1` |
| Ctrl-C | `130` |

- **stdout:** values (listing, single read), the change list and the apply hint.
- **stderr:** errors, warnings and hints, through the client's `error` / `warn` / `hint` helpers
  (`kerghan: error: …`, `kerghan: warning: …`, `kerghan: hint: …`), and usage errors through
  `usage_error`. Wizard prompts also go to stderr, like the `reset` confirmation, so stdout stays
  clean.

**A refusal writes nothing:** every check (all keys, all values, missing files) runs before the
first write.


## Pages

- [Files and the shared writer](client-config/files.md) — the two files, key routing, missing files, existing content, values, writing, change list, apply hint and required tests; read when changing what the writer accepts or prints.
- [`kerghan configure`](client-config/configure.md) — usage, list, single read, write, `KEY=-`, `--unset`, refused keys and required tests; read when working on the `configure` command.
- [`kerghan wizard`](client-config/wizard.md) — usage, questions, prompts, starting state, summary and confirmation, abort and required tests; read when working on the interactive wizard.
- [Security](client-config/security.md) — masking, inline secrets, changing the secrets, cross-key warnings, password change, file safety, Docker footprint and required tests; read when touching secrets handling.
