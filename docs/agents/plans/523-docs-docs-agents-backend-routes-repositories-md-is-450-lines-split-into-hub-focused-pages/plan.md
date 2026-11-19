# Plan: Docs: docs/agents/backend/routes/repositories.md is 450 lines — split into hub + focused pages

Issue: [523-docs-docs-agents-backend-routes-repositories-md-is-450-lines-split-into-hub-focused-pages.md](../../issues/523-docs-docs-agents-backend-routes-repositories-md-is-450-lines-split-into-hub-focused-pages.md)

## Overview
Pure reorganization of `docs/agents/backend/routes/repositories.md` (450 lines) into a slim hub plus five focused pages under `docs/agents/backend/routes/repositories/`, the same pattern as the earlier splits (#509–#511, #518–#521). Content moves verbatim; only headings' placement, relative links and inbound links change.

## Context
The file exceeds the 300-line cap in AGENTS.md. Current sections (line ranges): intro/Every route/Routes (1–45), Listing + Request/Response/Stale-sync trigger (46–120), Repository identity + Repo ref + Sync state + Polling contract (121–217), Refresh + Add + Add rate limit (218–316), Errors + Access (317–367), Required tests (368–450). Docs-only change, no code, no CI job applies.

## Implementation Steps

### Step 1 — Split the file
Create `docs/agents/backend/routes/repositories/` with:
- `listing.md` — Listing (Request, Response, Stale-sync trigger)
- `identity-and-sync.md` — Repository identity, Repo ref, Sync state, Polling contract
- `refresh-and-add.md` — Refresh, Add, Add rate limit
- `errors-and-access.md` — Errors, Access
- `required-tests.md` — Required tests

Each page starts with an `# H1` plus a back-link to the hub, and keeps its sections verbatim (heading text unchanged so slugs stay the same). Reduce the hub to the 1–2 paragraph summary, `Every route` and `Routes`, plus an index listing every page with a one-line "when to read" description. Rewrite relative links in moved content (one directory deeper: `../` → `../../` etc.) and cross-links between sections that now live on different pages. Verify every page, the hub included, is under 300 lines (`wc -l`) and that moved text is unchanged (diff of concatenated pages against the original body).

### Step 2 — Update inbound links
Retarget links to the new page and anchor (`backend/routes/repositories/<page>.md#<anchor>`):
- `#every-route`, `#routes` → stay on the hub
- `#listing`, `#request`, `#response`, `#stale-sync-trigger` → `listing.md`
- `#repository-identity`, `#repo-ref`, `#sync-state`, `#polling-contract` → `identity-and-sync.md`
- `#refresh`, `#add`, `#add-rate-limit` → `refresh-and-add.md`
- `#errors`, `#access` → `errors-and-access.md`
- `#required-tests` → `required-tests.md`

Re-run `grep -rn "routes/repositories.md#"` across the repo (excluding plans/issues) after editing to confirm no stale anchor remains; hub-only links (no anchor) may stay, and `docs/agents/specs.md` should also list the new pages.

## Files to Change
- `docs/agents/backend/routes/repositories.md` — slim to hub + index
- `docs/agents/backend/routes/repositories/{listing,identity-and-sync,refresh-and-add,errors-and-access,required-tests}.md` — new pages
- `docs/agents/specs/issues/api.md`, `docs/agents/architecture/security.md`, `docs/agents/modules/auth/github-handle.md`, `docs/agents/modules/repositories/{edge-cases,required-tests,sync,testing-coverage,frontend}.md` — retarget anchors
- `docs/agents/specs.md`, `docs/agents/modules/repositories.md`, `docs/agents/cache-warmer.md` — keep hub links valid; add new pages to the specs index

## Notes
- Page boundaries may shift if a page would exceed 300 lines; none is expected to.
- Re-grep `.claude/agents/*.md` and `AGENTS.md` for links before finishing (none found at planning time).
