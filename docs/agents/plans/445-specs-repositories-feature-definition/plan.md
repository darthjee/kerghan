# Plan: Specs: repositories feature definition

Issue: [445-specs-repositories-feature-definition.md](../../issues/445-specs-repositories-feature-definition.md)

## Overview

Docs-only. Create the temporary feature specs `docs/agents/specs/repos/` (a `README.md` plus six concern files) from the decisions of Epic #444, and register the feature under "Active specs" in `docs/agents/specs.md`. Points owned by the spec-enhancement sub-issues #446–#451 are named but left open with `> **Open — settled by #NNN:** …` markers. The specs are reviewed by the product-owner, security and data-access agents before the PR is opened.

## Context

- Lifecycle and conventions: `docs/agents/specs.md` (one `README.md` per feature with overview, scope, product decision and index; files split by concern; "Required tests" at the end of each file; specs describe decisions, not code).
- Shape precedent: the autocomplete specs (#425, commit `2fbe5a3`, readable with `git show 2fbe5a3:docs/agents/specs/auto-complete/README.md`) — including its "Sub-issues" table, its "Open markers" section and table, and the one-at-a-time order note.
- Source of every decision: the body of #444 (sections Scope, Integrations & ownership, Data model, Where the fetch happens, Fetch flow, UI, Performance & security considerations, Planned sub-issues, Split) and the issue file of #445 (Scope, Depth, Open-point markers, Sequencing, Reviewers).
- Existing docs the specs point at as conventions (never edited here): `docs/agents/modules/integrations.md` (access rules, "secrets never reach the browser", owner FK exception), `docs/agents/architecture/modular-pattern.md` (logical FKs), `docs/agents/modules/auth/default-user.md` (edit blocking), `docs/agents/architecture/security.md` (CSRF / `OriginGuard`), `docs/agents/architecture/caching.md` and `docs/agents/cache-warmer.md` (`X-Skip-Cache`), `docs/agents/flow.md` (steps 2–3), `docs/agents/product.md` ("What's still open", "Deferred").

## Steps

- [01 — README and Active specs entry](plan/01-readme-and-active-specs.md)
- [02 — model.md](plan/02-model.md)
- [03 — sync.md](plan/03-sync.md)
- [04 — api.md](plan/04-api.md)
- [05 — integrations.md](plan/05-integrations.md)
- [06 — security.md](plan/06-security.md)
- [07 — ui.md](plan/07-ui.md)
- [08 — Consistency pass and agent review](plan/08-consistency-and-review.md)

## Notes

- **Depth rule:** name routes (method + purpose), tables and columns, sync states, per-source and row statuses, and module boundaries; leave shapes, paths, values, codes, execution model, per-type auth, handle validation details, the edge-case matrix and the testing strategy as open markers linked to #446–#451.
- **Open markers:** every marker uses exactly `> **Open — settled by #NNN:** <decision>` and has a row in the README "Open markers" table (file + anchor, decision, issue). Owner map: #446 API contract, #447 sync engine, #448 Integrations GitHub client, #449 GitHub handle and default user, #450 edge cases, #451 testing strategy.
- **"Required tests"** in each non-README file covers only what is decided in #445; tests for open points are added by the issue that settles them (say so in each section).
- **Out of scope:** no code; no change to permanent docs (`product.md`, `flow.md`, `modules/`, `backend/routes/`, `architecture/security.md`, …) — that is #452; no `.claude/agents/` change.
- No CI job checks docs; verify relative links by hand in step 08.
