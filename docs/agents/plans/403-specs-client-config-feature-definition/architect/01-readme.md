# README.md
Write `docs/agents/specs/client-config/README.md`, modeled on the #390 `user-approval/README.md`:
title, one-line "temporary feature specs" intro naming product decision #402 and linking the
specs hub (`../../specs.md`).

Sections:
- **Overview** — the two commands (`configure` direct, `wizard` interactive) over
  `~/.kerghan/config` and `~/.kerghan/kerghan.env`; why (today only hand-editing).
- **Scope** — both files; key namespaces (lower-case config keys `port`, `variant`, `runtime`,
  `stop-timeout`, `image-tag`, `auto-login`, `bind`; upper-case env keys) and routing by key
  (no `--env`); the commands only write and print the change list + apply hint, never run
  `up`; existing commands, flags and file formats unchanged. Out of scope list.
- **Exit codes and streams** — the table from "Open decisions settled" 3 (0 / 0 for wizard "n"
  / 2 usage / 1 refusal / 130 Ctrl-C); stdout vs stderr, `error`/`warn`/`hint` helpers.
- **Alternatives rejected** — git-config style, `--env` flag, commands that run `up`,
  wizard-only.
- **Sub-issues** — #404 implements the writer + `configure` against `files.md`,
  `configure.md`, `security.md`; #405 implements `wizard` against `wizard.md`, `files.md`,
  `security.md`; #406 folds and removes the specs.
- **Index** — links to the four other files with one line each.

No "Required tests" section (index file).

## Files to Change
- `docs/agents/specs/client-config/README.md` — new.
