# Plan: Docs: docs/agents/architecture/infra.md is 435 lines — split into hub + focused pages

Issue: [524-docs-docs-agents-architecture-infra-md-is-435-lines-split-into-hub-focused-pages.md](../../issues/524-docs-docs-agents-architecture-infra-md-is-435-lines-split-into-hub-focused-pages.md)

## Overview
Turn `docs/agents/architecture/infra.md` (435 lines) into a slim hub and move its sections, unchanged in content, into four pages under `docs/agents/architecture/infra/`, following the pattern of #519–#522 (hub + focused pages). This is documentation only, so the architect owns it; no specialist agent has work.

## Context
AGENTS.md caps docs at 300 lines. The current sections map cleanly onto the proposed pages (line ranges in the current file):
- `workflow.md` — `## Workflow` (11–109): incl. `.codacy.yml` false positives, why `build-and-release` requires `release-kerghan`.
- `ci-jobs.md` — `## CI jobs` (110–220): `backend_db_tests`, MySQL version, `release-image` instances, leaf image tags and stale-image cleanup.
- `releases.md` — 221–370: `release-kerghan`, Render deploy, `release-kerghan-standalone`, `release-kerghan-assets`, production Dockerfile base selection, shared base Dockerfile.
- `ci-setup.md` — 371–435: CI setup pattern, validating the CircleCI config locally, Scripts, Migrations on production boot, No Navi warm-up job yet.

## Implementation Steps

### Step 1 — Create the focused pages and slim the hub
- Create the four pages with the section text moved verbatim. Each page gets a `# Infra — <topic>` title and a one-line back-link to the hub. Heading levels stay as they are (`##`/`###`), except a page may promote its top heading if needed for a `#` title.
- Rewrite `infra.md` as the hub: keep the intro paragraph, add a short pipeline summary (tests/lint on every push; semver-tag-gated release chain; base-image publish jobs), and end with an index linking every page under `infra/` with a one-line "read this when…" description.
- Fix relative links inside moved content (they now sit one folder deeper, e.g. `../` → `../../`), and any cross-references between sections that now live on different pages (`#anchor` → `page.md#anchor`).
- Verify each file is under 300 lines (`wc -l`) and that no text was dropped (compare the concatenated pages against the original via `git show HEAD:docs/agents/architecture/infra.md`).

### Step 2 — Update inbound links
Retarget links to moved sections to the new page and anchor, and mention the new pages where the hub is indexed:
- `docs/agents/standalone/install.md:58` — the `#release-kerghan-assets--client-assets-on-the-github-release` anchor → `../architecture/infra/releases.md#…`.
- `docs/agents/standalone/release-and-caveats.md:34,102`, `docs/agents/standalone.md:9,50`, `docs/agents/folder-structure.md:130`, `docs/agents/specs.md:65,71` — point to the page that holds the referenced topic (release jobs/Render → `releases.md`, MySQL CI job → `ci-jobs.md`); links that mean the whole pipeline may keep targeting the hub.
- `docs/agents/folder-structure.md:105` — mention the new `architecture/infra/` folder; `docs/agents/architecture.md:24` — optionally list the pages.
- Re-grep `architecture/infra` and `infra.md#` across `AGENTS.md`, `.claude/agents/*.md` and `docs/` to confirm no stale anchors remain.

## Files to Change
- `docs/agents/architecture/infra.md` — becomes the hub.
- `docs/agents/architecture/infra/{workflow,ci-jobs,releases,ci-setup}.md` — new pages.
- `docs/agents/standalone.md`, `docs/agents/standalone/install.md`, `docs/agents/standalone/release-and-caveats.md`, `docs/agents/folder-structure.md`, `docs/agents/specs.md`, `docs/agents/architecture.md` — inbound link updates.

## Notes
- Pure reorganization: no rewording beyond link fixes and the hub's summary/index.
- If a page boundary pushes any page near 300 lines, `releases.md` (~150) is the one to split further; currently all are well under the cap.
