# Plan: Docs: docs/agents/modules/integrations/oauth-app.md is 467 lines — split into hub + focused pages

Issue: [521-docs-docs-agents-modules-integrations-oauth-app-md-is-467-lines-split-into-hub-focused-pages.md](../../issues/521-docs-docs-agents-modules-integrations-oauth-app-md-is-467-lines-split-into-hub-focused-pages.md)

## Overview
Turn `docs/agents/modules/integrations/oauth-app.md` into a slim hub and move its sections, verbatim, into four focused pages under `docs/agents/modules/integrations/oauth-app/`. This mirrors the existing `github-app.md` + `github-app/` split (#517). The work is docs-only and cross-cutting, so the architect owns it; no specialist agent has work.

## Context
The file is 467 lines, above the 300-line cap in AGENTS.md. The issue fixes the page breakdown and the rules: every page under 300 lines, pure reorganization (no rewording), every inbound link and anchor updated, and relative links inside moved content fixed.

## Implementation Steps

### Step 1 — Split the file into the hub and four pages
Use the current line ranges of `oauth-app.md`:

| Page | Sections (current lines) |
|---|---|
| hub `oauth-app.md` | title + intro (1–7), `## Overview` (8–17), plus a new index of the four pages |
| `oauth-app/flow.md` | `## Flow` with Routes, Start, Landing, Callback, State (18–185) |
| `oauth-app/credentials.md` | Required scopes, Validate / create, Secret payload shape, Metadata shape, Expiry, Test connection, `invalid` reason codes, `secretHint` format (186–316) |
| `oauth-app/config-and-proxy.md` | Server config (+ When disabled), Proxy (Tent) (+ Landing page rule, Backend routes) (317–387) |
| `oauth-app/lifecycle.md` | Revocation, Behaviour on delete, Access, Error cases, Frontend (388–467) |

Rules while moving:
- Each new page gets a `# <Title>` heading and a one-line "Part of the [OAuth App type](../oauth-app.md)" pointer, as `github-app/*.md` do. Section headings and their text are otherwise unchanged. Keep heading text identical so anchors such as `#state`, `#landing`, `#start`, `#test-connection`, `#when-disabled`, `#server-config` and `#landing-page-rule` still exist on their new page.
- Rebase relative links inside the moved content, because the pages are one level deeper: `type-contract.md`, `data-model.md`, `security.md`, `pat.md`, `frontend.md` become `../…`, and `../../backend/…` and `../../environment-variables.md` become `../../../…`.
- Retarget links between the moved sections to the page that now holds them. For example, a link to `#state` from `flow.md` stays local, while a link to `#server-config` becomes `config-and-proxy.md#server-config`. Links to `#flow`, `#overview` and `#revocation` are retargeted the same way.
- In the hub, fix the links that remain in the Overview (`#flow`, `#server-config`) so they point into the new pages.
- The hub's index lists all four pages, each with a one-line "read this when…" description.
- Check each file stays under 300 lines with `wc -l`.

### Step 2 — Update inbound links
Retarget every link that points at a moved section:
- `docs/agents/environment-variables.md:157` (`oauth-app.md#server-config`, written as inline code) → `oauth-app/config-and-proxy.md#server-config`
- `docs/agents/backend/routes/integrations.md` lines 58, 59, 70 and 187 (`#routes`, `#flow`, `#when-disabled`, `#state`) → `oauth-app/flow.md#…` and `oauth-app/config-and-proxy.md#when-disabled`
- `docs/agents/modules/integrations/type-contract.md:80` (`#landing`) → `oauth-app/flow.md#landing`
- `docs/agents/modules/integrations/data-model.md:37` (`#state`) → `oauth-app/flow.md#state`
- `docs/agents/modules/integrations/github-app/credentials.md:203` (`#test-connection`) → `../oauth-app/credentials.md#test-connection`
- `docs/agents/modules/integrations/github-app/flow.md:55` (`#start`) and `:242` (`#state`) → `../oauth-app/flow.md#…`
- `docs/agents/modules/integrations/github-app/config-and-proxy.md:64` (`#landing-page-rule`) → `../oauth-app/config-and-proxy.md#landing-page-rule`

Links to the bare hub (`oauth-app.md` with no anchor, in `integrations.md`, `type-contract.md:73` and `github-service.md:113`) stay valid. Then run `grep -rn "oauth-app.md#" docs AGENTS.md .claude` to confirm no stale anchor on the hub remains. `AGENTS.md` and `.claude/agents/*.md` currently contain no references, but the grep confirms it.

## Files to Change
- `docs/agents/modules/integrations/oauth-app.md` — reduced to the hub: intro, Overview, index
- `docs/agents/modules/integrations/oauth-app/flow.md` — new
- `docs/agents/modules/integrations/oauth-app/credentials.md` — new
- `docs/agents/modules/integrations/oauth-app/config-and-proxy.md` — new
- `docs/agents/modules/integrations/oauth-app/lifecycle.md` — new
- `docs/agents/environment-variables.md`, `docs/agents/backend/routes/integrations.md`, `docs/agents/modules/integrations/type-contract.md`, `docs/agents/modules/integrations/data-model.md`, `docs/agents/modules/integrations/github-app/{credentials,flow,config-and-proxy}.md` — inbound links retargeted

## Notes
- Line ranges are from the current file and may shift slightly; split on the `##` headings, not on line numbers.
- Verify no content is lost: compare the concatenated body of the new pages against the original, aside from the added headers and rebased links.
- Docs-only change, so there are no CI jobs to run beyond any markdown/link lint the repo has.
