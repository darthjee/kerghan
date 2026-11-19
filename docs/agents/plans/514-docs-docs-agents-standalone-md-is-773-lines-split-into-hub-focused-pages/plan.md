# Plan: Docs: docs/agents/standalone.md is 773 lines — split into hub + focused pages

Issue: [514-docs-docs-agents-standalone-md-is-773-lines-split-into-hub-focused-pages.md](../../issues/514-docs-docs-agents-standalone-md-is-773-lines-split-into-hub-focused-pages.md)

## Overview
Turn `docs/agents/standalone.md` into a hub (summary, Overview, Why Vault, Out of scope, plus an index of every page under `docs/agents/standalone/`) and move the remaining sections, verbatim, into five focused pages. Pure reorganization, documentation only, so no specialist agent (backend, frontend, infra, ...) has work; the architect owns it, following the pattern of #509, #510 and #511.

## Context
The file is 773 lines, above the 300-line cap in `AGENTS.md`. Section line ranges in the current file: Requirements + Install and upgrade 54–151; The `kerghan` client 152–373; Configuration + `config` format 374–444; Inner stack 445–675; Images and versioning + Caveats + Testing 676–773. Each target page comes out at roughly 100–230 lines, so all stay under 300.

## Implementation Steps

### Step 1 — Create the pages and slim the hub
Create these pages in `docs/agents/standalone/`, copying the sections unchanged (headings may be demoted/promoted one level so each page starts with its own `# Title` and a "Part of [Standalone Distribution](../standalone.md)." line, as the existing `client-*.md` pages do):

- `install.md` — Requirements, Install and upgrade (Installing the client, Verifying the release assets, Upgrading).
- `client.md` — The `kerghan` client (Mapping to `vault`, Secrets incl. `update-env`/`configure`/`wizard`/`update`/`completion`, `FRONTEND_BASE_URL`, `up`, Other behavior).
- `config-files.md` — Configuration (`~/.kerghan/`) and the `config` format.
- `inner-stack.md` — Inner stack (MySQL 9.3 to 8.4.11 migration, Tent and the frontend, `/vault/.env` and multi-arch Tent, Dockerfile targets, Online and offline variants, Same origin and `OriginGuard`, Effective client IP, Verifying the effective client IP).
- `release-and-caveats.md` — Images and versioning, Caveats, Testing.

Page boundaries may shift slightly (e.g. split `inner-stack.md` if it nears 300 lines) as long as every page, hub included, stays under 300 lines.

Then rewrite `docs/agents/standalone.md` to keep only the 1–2 paragraph summary, Overview, Why Vault and Out of scope, and end it with an index listing every page under `docs/agents/standalone/` (the five new ones plus `client-completion.md`, `client-config.md`, `client-update.md`), each with a one-line "read this when ..." description.

Fix links in the moved content:
- Relative links gain one `../` (e.g. `environment-variables.md` → `../environment-variables.md`, `../../README.md` → `../../../README.md`, `standalone/client-config.md` → `client-config.md`).
- In-page anchors that pointed to sections now on another page (e.g. `#caveats`, `#config-format`, `#secrets`, `#update`, `#up-start-no-op-or-recreate`, `#effective-client-ip`, `#upgrading`, `#configure-and-wizard`, `#same-origin-and-originguard`) become cross-page links to the new file and anchor; the hub's own link to `#config-format` (line 29) points to `standalone/config-files.md#config-format`.

### Step 2 — Update inbound links
Retarget every link into a moved section to the new page and anchor (`standalone/<page>.md#<anchor>`); links to the bare hub stay as they are:

- `README.md` (lines ~103, 185): `#verifying-the-release-assets` → `install.md`, `#caveats` → `release-and-caveats.md`.
- `docs/agents/environment-variables.md` (~399, 405, 417): `#caveats`, `#same-origin-and-originguard`.
- `docs/agents/modules/auth/default-user.md` (~368, 374–375): `#secrets`, `#config-format`, `#effective-client-ip`.
- `docs/agents/architecture/infra.md` (~164): `#mysql-93-to-8411-migration`.
- `docs/agents/standalone/client-config.md` (~19): `#configuration-kerghan`; `docs/agents/standalone/client-update/contracts.md` (~55): `#upgrading`.
- `docs/agents/specs.md` (rows 65, 66, 68–70) and `docs/agents/folder-structure.md` (lines 11, 63, 99, 107, 110, 125): mention/list the new pages where they name sections of the hub; add the new pages to the `standalone/` row in `folder-structure.md`.
- `.claude/agents/standalone.md` (~39): point at the hub plus the new index.
- Re-grep for `standalone.md#` and `standalone.md)` across the repo (excluding `docs/agents/issues/` and `docs/agents/plans/`) to catch stragglers, and check `docs/agents/summary.md` and `index.md` entries still make sense.

## Files to Change
- `docs/agents/standalone.md` — slim to hub + index
- `docs/agents/standalone/{install,client,config-files,inner-stack,release-and-caveats}.md` — new pages
- `README.md`, `.claude/agents/standalone.md`, `docs/agents/{specs,folder-structure,environment-variables}.md`, `docs/agents/architecture/infra.md`, `docs/agents/modules/auth/default-user.md`, `docs/agents/standalone/client-config.md`, `docs/agents/standalone/client-update/contracts.md` — inbound links

## Notes
- Verify with `wc -l` that every page is under 300 lines, and with a link check (every relative link and anchor resolves) on the touched files; there is no code, so no test suite applies.
- Content moves without rewording; only headings' levels, page intros and links change.
