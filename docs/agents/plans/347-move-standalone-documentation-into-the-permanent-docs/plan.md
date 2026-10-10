# Plan: Move standalone documentation into the permanent docs

Issue: [347-move-standalone-documentation-into-the-permanent-docs.md](../../issues/347-move-standalone-documentation-into-the-permanent-docs.md)

## Overview

Fold the lasting content of the temporary standalone specs (`docs/agents/specs/standalone/`) into
the permanent docs, so #348 can delete the specs without losing knowledge. Users get a short
"Run Kerghan standalone" section in `README.md`. Agents and maintainers get a new permanent
reference, `docs/agents/standalone.md`. The existing docs (`environment-variables.md`,
`architecture/infra.md`, `folder-structure.md`, `external.md`) and the `standalone` agent
definition are updated to match what shipped in #342–#346.

This is a documentation-only change. The architect owns it; no specialist agent has code work.

## Context

- Source material: `docs/agents/specs/standalone/{README,client,config,installer,variables,stack,images}.md`.
  `render.md` is out of scope (#341 documents the Render deploy).
- Before writing, verify each statement against the shipped code. The specs describe intent, and
  the code is what shipped: `standalone/bin/kerghan`, `standalone/install.sh`,
  `standalone/config.example`, `standalone/vault/docker-compose.yml`,
  `dockerfiles/kerghan_standalone/Dockerfile`, `bin/release_kerghan_standalone.sh`,
  `bin/release_kerghan_assets.sh`, `.circleci/config.yml`. When the two disagree, document the
  code.
- Gaps found on `main`:
  - `infra.md` has no section on `release-kerghan-assets` / `bin/release_kerghan_assets.sh`.
  - `folder-structure.md` lists neither `standalone/`, `dockerfiles/kerghan_standalone/`, the new
    `bin/` scripts nor `.claude/agents/standalone.md`.
  - `external.md` says Vault is "not used by Kerghan yet".
  - `.claude/agents/standalone.md` still lists `standalone/kerghan.env.example`, which never
    shipped (`standalone/config.example` did), and points only to the specs hub.
- Out of scope: the Render deploy docs (#341); deleting the specs folder and its `specs.md` entry
  (#348).

## Steps

- [01 — Write docs/agents/standalone.md](plan/01-write-standalone-reference.md)
- [02 — Add the README "Run Kerghan standalone" section](plan/02-readme-section.md)
- [03 — Add the "Standalone" section to environment-variables.md](plan/03-environment-variables.md)
- [04 — Document the release assets in infra.md](plan/04-infra-release-assets.md)
- [05 — Update folder-structure.md](plan/05-folder-structure.md)
- [06 — Update external.md and the standalone agent](plan/06-external-and-agent.md)
- [07 — Verify no permanent doc links to the specs](plan/07-verify-links.md)

## Notes

- `docs/agents/specs.md` keeps its "Standalone distribution" entry: #348 removes it with the
  folder. That is the only allowed reference to `specs/standalone/` outside
  `specs/`, `issues/` and `plans/`.
- #341 is still open and also edits `infra.md` (the release diagram and `build-and-release`).
  Keep step 04's edits to the new section, the job table row and the scripts table row, so the
  merge with #341 stays simple. If #341 merges first, rebase onto it.
- Write in the same style as the existing docs: tables for contracts, short bullets, no
  sub-issue numbers in user-facing README text.
