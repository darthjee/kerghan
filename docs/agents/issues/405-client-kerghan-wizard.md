# Issue: Client: `kerghan wizard`

## Description

Third sub-issue of the client config Epic (#402). Builds on #404 (shared config/env writer +
`kerghan configure`), merged.

Implement `kerghan wizard [--advanced]` in the `kerghan` client (`standalone/bin/kerghan`): an
interactive command that asks one question per setting, shows the current value as the
default, prints a summary, and asks for confirmation before writing anything to
`~/.kerghan/config` and `~/.kerghan/kerghan.env` through the shared writer. The spec is
`docs/agents/specs/client-config/wizard.md`, together with `files.md` and `security.md` in the
same folder. Where this issue and the spec disagree, the spec wins.

## Problem

`kerghan configure` only works if the user already knows every key name and its valid values.
A first-time user has no guided way to set up the instance (port, variant, automatic login,
bind, default user) that shows the current values and checks each answer as it goes.

## Expected Behavior

- **Usage:** the `usage` "Commands:" list gets the line from `wizard.md` verbatim, after the
  `configure` lines. Any other option or argument exits `2`.
- **Questions:** by default it asks, in this order: port, variant, auto-login, bind, default user
  username, email, password (questions 1, 2, 6, 7, 10, 11, 12). `--advanced` asks all thirteen
  in table order, which adds `runtime`, `stop-timeout`, `image-tag`,
  `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN` and `FRONTEND_BASE_URL` (Public URL).
- **Prompts:** prompts go to stderr and answers are read from stdin. Each prompt shows the current
  value or the default in brackets. Pressing Enter keeps it, and when the key had no line, nothing
  is written. An invalid answer prints the validator message and asks again. An existing invalid
  `config` value is shown as invalid and the default is offered instead. Booleans accept
  `true`/`false`/`y`/`n`.
- **bind default:** when `bind` has no line, its default follows the auto-login answer
  (`127.0.0.1` when on, `0.0.0.0` when off).
- **Skipping the default user:** when auto-login is off and `KERGHAN_DEFAULT_USER_ENABLED` is
  `false`, questions 9–12 are skipped.
- **Public URL:** the default is derived from the port answer when it is unset. Enter writes
  nothing when it was never set.
- **Password:** (k)eep, (g)enerate (48 hex characters, the same generator as `up`, never printed;
  afterwards the wizard says the password is in `kerghan.env`) or (t)ype (hidden input, asked
  twice; a mismatch or fewer than 8 characters asks again). When `kerghan.env` has no password,
  keep is not offered and generate is the default.
- **Starting state:** these checks run before the first question; each one exits `1` and asks
  nothing:
  - no TTY: the error points to `kerghan configure`;
  - no `kerghan.env` but a data volume exists: the restore/`kerghan reset` hint;
  - a `config` line without `=`.
  With no `kerghan.env` and no volume, the file is created the same way `up` creates it, with the
  answers applied.
- **Summary:** before writing, the wizard prints the change list, with secrets shown as
  `<KEY>: changed`, then asks `Write these changes? [Y/n]`.
  - Y or Enter: writes everything at once (all or nothing), then prints the apply hint and any
    cross-key warning.
  - `n`: prints `Nothing written.` and exits `0`.
  - No changes: prints `Nothing changed.` and exits `0` without asking.
- **Abort:** Ctrl-C exits `130` and writes nothing. End of input before the confirmation exits
  `1` and writes nothing.
- It never asks for `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`, the client-managed pair or
  custom env vars. It never calls `vault` and never runs `kerghan up`.

## Solution

- Add `cmd_wizard` and register it in the command dispatch. Reuse what #404 already added: the
  `is_tty` helper (with the test-only `KERGHAN_ASSUME_TTY=true` override), the `valid_*` and
  env value validators, `key_changes` for the change list, and the atomic writer. Add no second
  write path.
- Collect every answer in memory and hand it to the shared writer only after confirmation. This
  is what keeps Ctrl-C, end of input and `n` from writing anything.
- Add bats tests in `standalone/test/`, driven through stdin with `KERGHAN_ASSUME_TTY=true`,
  covering every item in the "Required tests" list of `wizard.md`.
- Owner: the standalone agent.

## Benefits

- First-time users get a guided, validated setup without having to learn key names.
- One write path for `configure` and `wizard`, so the file rules and secret masking stay the same
  for both.
