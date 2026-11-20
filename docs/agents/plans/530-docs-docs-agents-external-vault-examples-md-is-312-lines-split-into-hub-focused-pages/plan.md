# Plan: Docs: docs/agents/external/vault/examples.md is 312 lines — split into hub + focused pages

Issue: [530-docs-docs-agents-external-vault-examples-md-is-312-lines-split-into-hub-focused-pages.md](../../issues/530-docs-docs-agents-external-vault-examples-md-is-312-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization owned by the architect. `docs/agents/external/vault/examples.md`
becomes a slim hub and its four setups move to focused pages under
`docs/agents/external/vault/examples/`.

## Context
The file is 312 lines, above the 300-line cap in AGENTS.md. The same hub + pages pattern was
applied to other docs in #524–#529. The only inbound link to `examples.md` is the index row in
`docs/agents/external/vault.md`, which still resolves because the hub keeps its path.

## Implementation Steps

### Step 1 — Create the pages
Create `examples/app-postgres.md`, `app-redis.md`, `multiple-compose-files.md` and
`baked-image-offline.md`, each holding its section verbatim (heading promoted to `#`, sub-headings
promoted one level). Each page opens with a back link to the hub, and the relative links to
sibling vault docs (`concepts.md`, `configuration.md`, `docker-run.md`, `security.md`,
`base-image.md`, `cli/...`) gain a `../` prefix.

### Step 2 — Slim the hub
Keep the intro (title, back link, variant table, placeholder notes, links to concepts/operations/
troubleshooting) in `examples.md` and end it with an index of the four pages with a one-line
description each. Fix the intro's relative links only if needed (they stay valid since the hub
does not move).

## Files to Change
- `docs/agents/external/vault/examples.md` — reduced to intro + pages index
- `docs/agents/external/vault/examples/app-postgres.md` — new
- `docs/agents/external/vault/examples/app-redis.md` — new
- `docs/agents/external/vault/examples/multiple-compose-files.md` — new
- `docs/agents/external/vault/examples/baked-image-offline.md` — new

## Notes
- Every page stays under 300 lines; no content is rewritten, only moved.
- No code or CI changes; no inbound link outside the vault docs needs retargeting.
