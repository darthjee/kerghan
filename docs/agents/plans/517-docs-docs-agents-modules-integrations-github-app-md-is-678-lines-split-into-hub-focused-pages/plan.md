# Plan: Docs: docs/agents/modules/integrations/github-app.md is 678 lines — split into hub + focused pages

Issue: [517-docs-docs-agents-modules-integrations-github-app-md-is-678-lines-split-into-hub-focused-pages.md](../../issues/517-docs-docs-agents-modules-integrations-github-app-md-is-678-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization, owned by the architect (root-level `docs/`). Turn `docs/agents/modules/integrations/github-app.md` into a hub and move its sections into four pages under `docs/agents/modules/integrations/github-app/`, following the pattern of #513–#516. No content is rewritten, dropped or changed in meaning; only links and anchors are adjusted.

## Context
The file is 678 lines (cap: 300). Current section line ranges and resulting pages:

| Page | Sections | Approx. lines |
|---|---|---|
| hub `github-app.md` | intro, Overview, Why ownership has to be verified, page index | ~35–45 |
| `github-app/flow.md` | Flow (Routes, Start, Landing, Callback, Selection, State) | ~261 |
| `github-app/credentials.md` | User token, Required permissions, Validate / create (App JWT), Secret payload shape, Metadata shape, Identity, Expiry, Installation token cache, Test connection, `invalid` reason codes, `secretHint` format | ~217 |
| `github-app/config-and-proxy.md` | Server config (When disabled), Proxy (Tent: Landing page rule, Backend routes) | ~76 |
| `github-app/lifecycle.md` | Behaviour on delete, Access, Error cases, Frontend | ~91 |

## Implementation Steps

### Step 1 — Create the pages and slim the hub
- Move each section verbatim (headings included) into its page, each with a short `# Title` and a one-line "Part of the [GitHub App type](../github-app.md)" back-link.
- Hub keeps the `# Integration type: GitHub App installation (`github_app`)` title, intro paragraph, `## Overview` and `### Why ownership has to be verified`, then ends with an index linking every page with a one-line "read when…" description.
- Fix relative links in moved content: pages are one level deeper, so `data-model.md`, `oauth-app.md`, `type-contract.md`, `security.md`, `github-service.md`, `frontend.md` become `../…`, and `../../backend/…`, `../../environment-variables.md` become `../../../…`.
- Fix intra-file `#anchor` links: same-page anchors stay; cross-page ones become `<page>.md#anchor` (e.g. `[Server config](#server-config)` in flow → `config-and-proxy.md#server-config`; `[State](#state)` in credentials → `flow.md#state`; `[Validate / create](#validate--create)` in flow → `credentials.md#validate--create`; `[Landing](#landing)` / `[Behaviour on delete](#behaviour-on-delete)` in lifecycle's Frontend likewise). Hub's `(#flow)` and `(#server-config)` links point to the new pages.

### Step 2 — Update inbound links, verify
Anchor map (old `github-app.md#…` → new page): `routes`, `flow`, `selection`, `state`, `landing` → `github-app/flow.md`; `validate--create`, `installation-token-cache` → `github-app/credentials.md`; `server-config`, `when-disabled` → `github-app/config-and-proxy.md`; `access` → `github-app/lifecycle.md`.

Inbound links to update:
- `docs/agents/environment-variables.md:186` (`#server-config`)
- `docs/agents/backend/routes/integrations.md:60-62, 72, 187, 192`
- `docs/agents/modules/integrations/data-model.md:39, 162`
- `docs/agents/modules/integrations/github-service.md:124 (hub, unchanged), 163`
- `docs/agents/modules/integrations/type-contract.md:74 (hub, unchanged), 81`
- `docs/agents/specs.md:71` (add the new pages next to the hub link; installation-token cache → `credentials.md`)
- `docs/agents/specs/issues/security.md:38` (names "Required permissions" → `credentials.md`)
- `docs/agents/folder-structure.md` if it lists the integrations docs; `.claude/agents/*.md` and `AGENTS.md` had no matches.

Verify: `wc -l` on every page (< 300 each); run a link check over `docs/` (all relative links and anchors in the touched files resolve); `git diff --stat` shows content moved, not changed (compare section text before/after).

## Files to Change
- `docs/agents/modules/integrations/github-app.md` — slimmed to hub
- `docs/agents/modules/integrations/github-app/{flow,credentials,config-and-proxy,lifecycle}.md` — new
- `docs/agents/environment-variables.md`, `docs/agents/backend/routes/integrations.md`, `docs/agents/modules/integrations/{data-model,github-service,type-contract}.md`, `docs/agents/specs.md`, `docs/agents/specs/issues/security.md`, `docs/agents/folder-structure.md` — inbound link/anchor updates

## Notes
- Docs only; no CI job runs on these files beyond any docs link checker if present.
- Page boundaries may shift slightly if a section's internal cross-references read better elsewhere, as long as every page stays under 300 lines.
