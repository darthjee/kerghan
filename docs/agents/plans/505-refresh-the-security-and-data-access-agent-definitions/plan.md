# Plan: Refresh the security and data-access agent definitions

Issue: [505-refresh-the-security-and-data-access-agent-definitions.md](../../issues/505-refresh-the-security-and-data-access-agent-definitions.md)

## Overview

Rewrite the read-only `security` and `data-access` reviewer agents around the issue's hybrid,
discovery-driven approach: a short surface summary that links to the docs owning each mechanism, a
discovery rule that finds feature and module rules, inline check lists, defined edge-case behavior,
and an extended (not replaced) output format. `architect.md` gets the full trigger list for both
agents, and a few docs are synced (Definition of Done maintenance rule, `product.md` TODO,
`specs/issues/security.md` references to #505). Every file touched is an agent definition or a doc
under `.claude/agents/` or `docs/agents/`, which is the architect's own scope, so the plan has no
specialist split.

## Context

The current agents predate accounts, sessions, `OriginGuard`, encrypted GitHub credentials in
Integrations, cache classes and TypeORM, and `data-access` still "flags by default" against an
access-control section that was never written. The issue's sections are the source of truth for
content: Approach, Edge cases, Backward compatibility, Check lists, Overlap, Invocation triggers,
Maintenance rule, Testing strategy and Scope. The step files below say where each piece lands; they
do not restate it.

## Steps

- [01 — Rewrite the security agent](plan/01-rewrite-security-agent.md)
- [02 — Rewrite the data-access agent](plan/02-rewrite-data-access-agent.md)
- [03 — Rewrite the architect's review section](plan/03-rewrite-architect-review-section.md)
- [04 — Sync the related docs](plan/04-sync-related-docs.md)
- [05 — Verify links and dry-run the agents](plan/05-verify-and-dry-run.md)

## Notes

- No code, tests or CI jobs are touched; there is no CI check for agent prompts. Verification is
  step 05, whose reports go in the PR description and are not committed.
- Agent names, `tools: Read, Bash` and the read-only role must not change
  (`.claude/state/arcanum-config.json` maps `data-access` to an author identity).
- Out of scope (per the issue): a central `docs/agents/access-control.md`, `product-owner.md`
  (#512), `cache.md`, pipeline skills, and fixing any findings the refreshed agents surface.
- Keep each surface-summary line to one line plus a link; the point of the approach is that details
  live in the linked docs, not in the agent.
