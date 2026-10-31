# Architect Plan: Specs: client config feature definition

Issue: [403-specs-client-config-feature-definition.md](../../issues/403-specs-client-config-feature-definition.md)

## Overview
Write `docs/agents/specs/client-config/` — `README.md`, `files.md`, `configure.md`,
`wizard.md`, `security.md` — capturing every decision in the issue's Solution ("Open
decisions settled" and "Decisions by spec file"), and add the feature to "Active specs" in
`docs/agents/specs.md`. No code changes.

## Context
- Epic #402 split into #403 (this, specs), #404 (shared writer + `configure`), #405
  (`wizard`) and #406 (fold specs into permanent docs).
- Lifecycle and conventions: `docs/agents/specs.md` (one `README.md` index per feature, files
  split by concern, "Required tests" at the end of each file, decisions not code).
- Precedent layout and tone: the user approval specs from #390 (`git show
  71f7fa2:docs/agents/specs/user-approval/README.md` and siblings).
- Code the specs point at as conventions (never prescribe code): `standalone/bin/kerghan`
  (`load_config`, `valid_*`, `ensure_env_file`, `DEFAULT_ENV_KEYS`, `default_env_value`,
  `refuse_client_managed_keys`, `volume_exists`, `cmd_update_env`, `error`/`warn`/`hint`,
  `usage_error`), `standalone/config.example`, `docs/agents/standalone.md`,
  `docs/agents/modules/auth/default-user.md` (boot sync of the default user).

## Steps

- [01 — README.md](architect/01-readme.md)
- [02 — files.md](architect/02-files.md)
- [03 — configure.md](architect/03-configure.md)
- [04 — wizard.md](architect/04-wizard.md)
- [05 — security.md](architect/05-security.md)
- [06 — Active specs entry](architect/06-active-specs-entry.md)
- [07 — Consistency pass](architect/07-consistency-pass.md)

## CI Checks
- None specific: docs-only change; no CI job lints `docs/`.

## Notes
- Out of scope: `standalone/bin/kerghan` and its `usage` (#404/#405),
  `standalone/config.example`, `docs/agents/standalone.md`, root `README.md` (#406),
  `CLAUDE.md` / `AGENTS.md`.
- If a decision conflicts with the client's current behavior, adjust it in the spec and call
  it out in the PR description (per the issue's Scope) — do not stop to ask.
