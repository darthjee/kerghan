# Plan: Docs: docs/agents/external/vault/cli.md is 425 lines — split into hub + focused pages

Issue: [526-docs-docs-agents-external-vault-cli-md-is-425-lines-split-into-hub-focused-pages.md](../../issues/526-docs-docs-agents-external-vault-cli-md-is-425-lines-split-into-hub-focused-pages.md)

## Overview
Turn `docs/agents/external/vault/cli.md` (425 lines) into a short hub and move its sections,
verbatim, into five focused pages under `docs/agents/external/vault/cli/`. Pure reorganization:
no content is rewritten, dropped or changed in meaning. Every page, the hub included, stays
under 300 lines. The work is docs-only and cross-cutting, so the architect does it directly
(no specialist agent has work).

## Context
Same pattern as the earlier hub + focused-pages splits (#509, #510, #511, #523, #524, #525).
Page boundaries follow the file's current sections (line ranges of the current file):

| New page | Sections moved | Approx. lines |
|---|---|---|
| `cli/install.md` | Supported platforms, Install (Pinning a version, Installer variables, PATH, Installer errors), Download and verify, Shell completion (L22–135) | ~115 |
| `cli/commands.md` | Commands, Arguments of `compose` and `run`, Exit codes, Messages (L136–226) | ~91 |
| `cli/runtime.md` | Instances, Runtime, Options (L227–318) | ~92 |
| `cli/config-files.md` | `.vault.env`, `.vaultrc`, Precedence (L319–389) | ~71 |
| `cli/guardrails.md` | Guardrails, Baked images, Docker Desktop (L390–425) | ~36 |

The hub `cli.md` keeps the title, the back link to the Vault guides index, the intro (the
1–2 paragraphs and the `vault up`/`status`/… example, L1–21) and ends with an index of the five
pages, each with a one-line "read this when…" description.

## Implementation Steps

### Step 1 — Create the pages and slim the hub
- Create the five pages by moving the sections listed above verbatim (headings and anchors
  unchanged; each page gets a `# <Title>` H1 and a "Back to the [CLI hub](../cli.md)" line;
  the existing `##`/`###` section headings stay as they are).
- Fix relative links inside the moved content so they resolve from `cli/`:
  - `security.md…`, `concepts.md…`, `configuration.md…`, `operations.md…`, `base-image.md`
    → prefixed with `../` (originally at cli.md L31, 247, 274, 310, 317, 333, 400, 401, 405).
  - Cross-page anchors that used to be same-file: `[`.vaultrc`](#vaultrc)` (Instances, in
    `runtime.md`) → `config-files.md#vaultrc`; `[Instances](#instances)` and
    `[Runtime](#runtime)` in the Options table stay as-is (same page, `runtime.md`).
  - Any other same-file anchor found while moving must be re-pointed to the page that now holds
    its target.
- Reduce `cli.md` to the hub described above (index of the five pages).

### Step 2 — Update inbound links
Files outside `cli/` that link to moved sections (all under `docs/agents/external/vault/`
unless noted); retarget to `cli/<page>.md#<anchor>`:

| File (line) | Old target | New target |
|---|---|---|
| `examples.md` (81) | `cli.md#vaultenv` | `cli/config-files.md#vaultenv` |
| `examples.md` (201) | `cli.md#vaultrc` | `cli/config-files.md#vaultrc` |
| `examples.md` (302) | `cli.md#baked-images` | `cli/guardrails.md#baked-images` |
| `troubleshooting.md` (60) | `cli.md#exit-codes`, `cli.md#messages` | `cli/commands.md#exit-codes`, `cli/commands.md#messages` |
| `troubleshooting.md` (118) | `cli.md#docker-desktop` | `cli/guardrails.md#docker-desktop` |
| `configuration.md` (106–107) | `cli.md#precedence`, `cli.md#vaultenv` | `cli/config-files.md#precedence`, `cli/config-files.md#vaultenv` |
| `operations.md` (39, 49) | `cli.md#instances` | `cli/runtime.md#instances` |
| `operations.md` (128) | `cli.md#commands` | `cli/commands.md#commands` |
| `base-image.md` (113) | `cli.md#baked-images` | `cli/guardrails.md#baked-images` |

Links to the bare hub (`docs/agents/external/vault.md` L41 and L59, `docker-run.md` L157) still
resolve; leave them, but refresh the index description at `vault.md` L59 only if the hub's scope
sentence changed. Re-run the grep for `cli.md#` and `vault/cli.md` across the repo (AGENTS.md,
`.claude/agents/*.md`, `docs/`) at the end to confirm no stale anchor remains.

## Files to Change
- `docs/agents/external/vault/cli.md` — slimmed to hub + index
- `docs/agents/external/vault/cli/install.md` — new
- `docs/agents/external/vault/cli/commands.md` — new
- `docs/agents/external/vault/cli/runtime.md` — new
- `docs/agents/external/vault/cli/config-files.md` — new
- `docs/agents/external/vault/cli/guardrails.md` — new
- `docs/agents/external/vault/{examples,troubleshooting,configuration,operations,base-image}.md` — inbound anchors retargeted

## Notes
- Verification: `wc -l` on every page (< 300), and a link check that every relative link in the
  new pages and in the edited files resolves to an existing file and heading.
- Content must be moved, not edited; a diff of concatenated sections vs. the original should
  differ only in link prefixes, H1/back-link lines and the hub.
