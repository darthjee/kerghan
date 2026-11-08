# Plan: Specs: repositories — edge cases matrix

Issue: [450-specs-repositories-edge-cases-matrix.md](../../issues/450-specs-repositories-edge-cases-matrix.md)

## Overview

A docs-only change under `docs/agents/specs/repos/`. It does three things:

- creates `edge-cases.md`, the matrix with one table per area;
- writes the 15 new or changed rules (plus one accepted case) into their owning spec files, each
  with a "Required tests" entry;
- closes every #450 open marker and "#450 may" note, then updates the README.

No code changes. The architect owns all of it, since only specs change.

## Context

- The issue's Solution is the source of truth. Its subsections give, per topic, the matrix rows,
  each new rule, the files it lands in, and its tests. Its "Rule changes at a glance" table lists
  every rule with its owning files.
- **Conventions:**
  - follow the existing spec files (short sections, links with anchors, a "Required tests"
    section per file);
  - the matrix is an **index**: one line per case and a Rule link, never a second copy of a rule;
  - settled cases link to their existing rule without restating it.
- **Order:** the rule edits (steps 02–04) come before the matrix and the README (steps 01 and 05
  are written against the final anchors). Step 06 checks everything.

## Steps

- [01 — Create edge-cases.md](plan/01-edge-cases-matrix.md)
- [02 — model.md and sync.md rules](plan/02-model-and-sync.md)
- [03 — api.md, integrations.md and security.md rules](plan/03-api-integrations-security.md)
- [04 — ui.md rules](plan/04-ui.md)
- [05 — README](plan/05-readme.md)
- [06 — Consistency checks and reviews](plan/06-consistency-and-review.md)

Recommended execution order: 02 → 03 → 04 → 01 → 05 → 06.

## Notes

- **Do not restate settled rules in the matrix.** Every Rule cell links to an anchor that must
  exist once steps 02–04 are done.
- **New anchors** (for example `sync.md#link-fill` and `model.md#user-deletion`) must be
  introduced by headings, so that the matrix and the README can link to them.
- **The page-cap change replaces existing text and tests:** "nothing past the cap is deleted"
  appears in `sync.md` in several places (end of a source, partial failures, Required tests).
- **The `sources[]` wording change** in `api.md#listing` must not change the response shape.
- **Leave the permanent docs untouched.** Anything for them goes only into the README's #452
  checklist.
