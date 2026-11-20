# Plan: Refresh the product-owner agent definition

Issue: [512-refresh-the-product-owner-agent-definition.md](../../issues/512-refresh-the-product-owner-agent-definition.md)

## Overview

Rewrite `.claude/agents/product-owner.md` so it stops repeating a stale product state. It gets a map of decided areas (links only), a fixed reading order with spec precedence, and six fixed lowercase verdicts, two of them shared word for word with `data-access`. Add a "Product check" subsection to `.claude/agents/architect.md` so the agent is actually called before planning. Remove the stale bullet in `docs/agents/product.md`, and add map upkeep to the specs fold step and to the Issues and Projects fold list.

## Context

- The agent's "Current state: partial" section says repo selection is the only thing persisted and the tracked-repo model is open. Both are wrong now: Integrations, Repositories, Default user and User approval are decided, and the Issues and Projects spec (epic #483) persists issues.
- Nothing in `architect.md` invokes `product-owner` today. Its only mentions are the roster in `AGENTS.md` and `folder-structure.md`.
- `data-access.md` (refreshed in #505) already uses a discovery rule and the verdicts "undecided — needs product decision" and "no documented rule" (lowercase, quoted). `architect.md` routes "undecided — needs product decision" to the user.
- Every touched file is documentation or an agent definition, all in the architect's own scope. No specialist agent has work.

## Steps

- [01 — Rewrite the product-owner agent](plan/01-rewrite-product-owner-agent.md)
- [02 — Add the Product check to architect.md](plan/02-architect-product-check.md)
- [03 — Product and specs doc updates](plan/03-product-and-specs-docs.md)
- [04 — Manual verification](plan/04-manual-verification.md)

## CI Checks

- No CI job covers `.claude/agents/` or `docs/agents/` markdown. Verification is the manual checks in step 04, with their results in the PR description.

## Notes

- **Do not run any language runtime or package manager on the host** (project boundary). The checks in step 04 use only `ls` and `grep`.
- Check the map against `product.md`'s `##` sections at implementation time. Docs have recently been split into hub and focused pages (#514–#518), so confirm every linked path still exists.
- `architect.md`'s own "Data model" section (around line 153) also says the tracked-repo model is still open. That's outside #512's scope as written. Point it at `product.md` in a one-line edit only if that's trivially consistent with step 02; otherwise leave a follow-up note in the PR description.
- `specs/issues/model.md` belongs to an active spec. Adding one row to its fold list is the kind of in-PR spec update `specs.md` Lifecycle step 2 allows.
- `AGENTS.md` and `CLAUDE.md` are the user's own files and are not touched.
