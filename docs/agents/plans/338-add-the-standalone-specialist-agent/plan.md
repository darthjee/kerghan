# Plan: Add the standalone specialist agent

Issue: [338-add-the-standalone-specialist-agent.md](../../issues/338-add-the-standalone-specialist-agent.md)

## Overview

Add a `standalone` specialist agent owning the Vault-based standalone distribution
(`standalone/`, `dockerfiles/kerghan_standalone/Dockerfile`, how Vault is used), carve that scope
out of `infra`, and register the new agent everywhere the agent roster is listed. All changes are
agent definitions and root/docs files, so the work is done by the `architect` — no specialist
code changes.

## Context

Part of epic #336. The standalone specs (#337, `docs/agents/specs/standalone/`) already assign
#342 and #344 to a `standalone` agent ("Repo layout" and "Sub-issue map" tables in the specs
README). Today `infra` claims all of `dockerfiles/` and is named as the consumer of the Vault
guide in `docs/agents/external.md`. Agents must link to the specs only through the hub entry
("Standalone distribution" in `docs/agents/specs.md`), never to `docs/agents/specs/standalone/`
directly, so #348 can delete the folder without touching agent files.

## Steps

- [01 — Create the standalone agent](plan/01-create-standalone-agent.md)
- [02 — Narrow the infra agent](plan/02-narrow-infra-agent.md)
- [03 — Update the agent lists](plan/03-update-agent-lists.md)

## Notes

- `standalone/` and `dockerfiles/kerghan_standalone/` do not exist yet (created by #342/#344);
  the agent describes its scope up front.
- Out of scope: `docs/agents/folder-structure.md`, `docs/agents/architecture/infra.md`, the
  README — folded in by #347. No new delegation/routing rules in `architect.md`, only the roster
  row.
- No CI job covers Markdown; verify manually that no agent file links into
  `docs/agents/specs/standalone/` (`grep -rn "specs/standalone" .claude/agents` must return
  nothing).
