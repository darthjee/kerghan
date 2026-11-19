# Plan: Docs: docs/agents/standalone/client-config.md is 684 lines — split into hub + focused pages

Issue: [516-docs-docs-agents-standalone-client-config-md-is-684-lines-split-into-hub-focused-pages.md](../../issues/516-docs-docs-agents-standalone-client-config-md-is-684-lines-split-into-hub-focused-pages.md)

## Overview
Pure docs reorganization, owned by the architect (no specialist owns `docs/agents/`). `docs/agents/standalone/client-config.md` becomes a hub; its sections move verbatim into four pages under `docs/agents/standalone/client-config/`, the same pattern as #509, #510, #511, #513, #514 and #515.

## Context
Current section line ranges of `client-config.md` (684 lines): hub material 1–81 (summary, Overview and scope, Exit codes and streams), Files and the shared writer 82–275, `kerghan configure` 276–428, `kerghan wizard` 429–586, Security 587–684. Every resulting page lands under 300 lines (~80 / ~195 / ~155 / ~160 / ~100), so the proposed boundaries hold unchanged.

## Implementation Steps

### Step 1 — Create the pages and slim the hub
- Create `client-config/files.md` (Files and the shared writer, 82–275), `configure.md` (276–428), `wizard.md` (429–586) and `security.md` (587–684). Move text verbatim; each page gets only a title, a one-line "Part of [Client config](../client-config.md)" pointer and its section content, with headings demoted/kept so anchors stay predictable.
- Reduce `client-config.md` to the 1–2 paragraph summary (keeping the code/tests pointer), Overview and scope, Exit codes and streams, and an index table linking every page with a one-line "read when" description. Replace the old in-page section list.
- Fix links:
  - Intra-doc anchors that now cross pages (e.g. `#key-routing`, `#apply-hint`, `#missing-files`, `#refused-keys`, `#masking`, `#changing-the-secrets`, `#cross-key-warnings`, `#password-change`, `#values`, `#existing-content`, `#writing`, `#change-list`, `#key-`) must point to the page that now holds the heading (e.g. `files.md#key-routing`); links within the same page stay as `#anchor`. Links from the hub into moved sections point to the new page.
  - Relative links inside moved content gain one `../` level: `config-files.md` → `../config-files.md`, `client-update.md#…` → `../client-update.md#…`, `../modules/auth/default-user.md` → `../../modules/auth/default-user.md`, `../modules/integrations.md` → `../../modules/integrations.md`, `../standalone.md` → `../../standalone.md`.
- Verify afterwards that no page exceeds 300 lines and that no section text was changed (diff of concatenated moved content vs. the original, modulo links).

### Step 2 — Retarget inbound links and comments
Update every reference to a moved section so it targets the new page and anchor:
- `README.md:177`
- `docs/agents/specs.md:68`, `docs/agents/standalone.md:65` (hub link stays valid; adjust wording only if it lists sections), `docs/agents/folder-structure.md:107` (mention the new `standalone/client-config/` folder), `docs/agents/standalone/client.md:151`, `docs/agents/environment-variables.md`, `docs/agents/standalone/release-and-caveats.md:98` (re-check each for section-specific links)
- Code comments: `standalone/bin/kerghan:589` and `:2800` (`#kerghan-wizard` → `client-config/wizard.md`), `standalone/test/configure.bats:2`, `configure_files.bats:3`, `configure_security.bats:2`, `wizard.bats:2`
- Grep `.claude/agents/*.md` and `AGENTS.md` for `client-config` (none found at planning time) and re-check at the end.

## Files to Change
- `docs/agents/standalone/client-config.md` — slimmed to hub + index
- `docs/agents/standalone/client-config/{files,configure,wizard,security}.md` — new pages
- `README.md`, `docs/agents/specs.md`, `docs/agents/standalone.md`, `docs/agents/folder-structure.md`, `docs/agents/standalone/client.md`, `docs/agents/environment-variables.md`, `docs/agents/standalone/release-and-caveats.md` — inbound links
- `standalone/bin/kerghan`, `standalone/test/{configure,configure_files,configure_security,wizard}.bats` — comment-only path/anchor updates

## Notes
- Comment-only changes in `standalone/` must not alter behavior; no tests need to run beyond a grep for stale `client-config.md#` anchors.
- No CI jobs apply to docs-only changes.
