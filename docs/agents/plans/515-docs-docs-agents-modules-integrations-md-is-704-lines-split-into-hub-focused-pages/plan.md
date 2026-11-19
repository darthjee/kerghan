# Plan: Docs: docs/agents/modules/integrations.md is 704 lines — split into hub + focused pages

Issue: [515-docs-docs-agents-modules-integrations-md-is-704-lines-split-into-hub-focused-pages.md](../../issues/515-docs-docs-agents-modules-integrations-md-is-704-lines-split-into-hub-focused-pages.md)

## Overview
Turn `docs/agents/modules/integrations.md` into a hub (summary, Overview, Types, index) and move
its four big sections into `docs/agents/modules/integrations/`. Pure reorganization: content is
moved verbatim, only links and anchors change. Docs-only, no agent split (architect-level work, no
specialist scope applies).

## Context
The file is 704 lines (cap: 300). Current section line ranges: Data model 57–256 (~200),
Security 257–449 (~193), Type contract 450–623 (~174), Frontend 624–699 (~76), Types 700–704.
The Overview (6–56) and Types stay in the hub. The folder already holds `github-app.md`,
`github-service.md`, `oauth-app.md`, `pat.md`, so the new names (`data-model.md`, `security.md`,
`type-contract.md`, `frontend.md`) do not collide.

Anchors that move (old `integrations.md#x` → new page):
- `data-model.md`: storage-model, tables, integrations-columns, owner-foreign-key, constraints,
  status-lifecycle, transitions, expiry, edge-cases, lockout-table, migrations
- `security.md`: access-rules, encryption-at-rest, binding-to-the-row-aad, key, key-id,
  secrets-never-logged, rate-limiting, create-and-replace-credential-failure-cool-off,
  test-connection-cooldown, faking-github-in-tests
- `type-contract.md`: strategy-interface, flow-kind, redirect-flow-invariants, validate--create,
  test-connection, describe-metadata, mask-the-secret, behaviour-on-delete, status-reason-codes,
  registration, what-a-type-doc-must-contain
- `frontend.md`: menu-item, page, list-columns, actions, type-picker, credential-input-rules
- stay in hub: overview, types

## Implementation Steps

### Step 1 — Split the file
Create the four pages with the section bodies copied verbatim (each gets a `# Integrations —
<topic>` title and a one-line back-link to the hub; headings are demoted/kept so anchors stay
identical, `##` sections becoming the page's top-level `##` or `#` as needed). Rewrite the hub:
keep the 1–2 paragraph summary, Overview, Types, and add an index of every page under
`integrations/` (the four new ones and the four type docs) with a one-line "read when" each.
Inside moved content: fix relative links (`../backend/...` → `../../backend/...`,
`repositories.md` → `../repositories.md`, `integrations/x.md` → `x.md`) and retarget in-page
`#anchor` links that now cross pages (e.g. `[Types](#types)` → hub, `[Mask the secret](#mask-the-secret)`
from data-model → `type-contract.md#mask-the-secret`). Verify each page and the hub is under 300
lines (`wc -l`) and that no body text changed (diff of concatenated sections vs. original).

### Step 2 — Update inbound links
Retarget every link to a moved anchor, found with
`grep -rn 'integrations\.md' . --include=*.md` plus source-code comments:
- `docs/agents/modules/integrations/{pat,oauth-app,github-app,github-service}.md` (`../integrations.md#x` → `x.md#x` page)
- `docs/agents/backend/routes/integrations.md`, `backend/routes.md`, `backend/routes/repositories.md`
- `docs/agents/environment-variables.md` (`#encryption-at-rest` → `modules/integrations/security.md#...`)
- `docs/agents/architecture/modular-pattern.md` (`#owner-foreign-key`)
- `docs/agents/specs.md` (Integrations row: "its *Security* section" → list new pages), `summary.md`,
  `product.md`, `flow.md`, `folder-structure.md`, `standalone/client-config.md` (hub links stay valid; adjust only if pointing at moved sections)
- `AGENTS.md` and `.claude/agents/*.md` if they reference moved sections
- code comments in `backend/src/integrations/**`, `backend/src/database/migrations/20261002120011-integrations-create-integrations.ts`
  and `frontend/assets/js/client/IntegrationsClient.js` that cite `integrations.md#section` — point at the new page (comment-only edits, no logic change).
Finish with a link check: every relative `.md` link/anchor touched resolves.

## Files to Change
- `docs/agents/modules/integrations.md` — slimmed to hub + index
- `docs/agents/modules/integrations/{data-model,security,type-contract,frontend}.md` — new
- Inbound-link files listed in Step 2

## CI Checks
- Docs only; no runtime change. Comment-only edits in `backend/` and `frontend/` need no test run, but `grep` for stale `integrations.md#` anchors must come back clean.

## Notes
- Slugs with `/` in headings (e.g. "Validate / create") must keep the same heading text so the anchor `validate--create` is preserved.
- Page boundaries may be adjusted if a page would exceed 300 lines.
