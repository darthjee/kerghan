# Plan: Refactor: Tighten the AGENTS.md wording flagged by Agentlinter

Issue: [234-refactor-tighten-the-agents-md-wording-flagged-by-agentlinter.md](../../issues/234-refactor-tighten-the-agents-md-wording-flagged-by-agentlinter.md)

## Overview
Docs-only change (architect scope, root-level file) that resolves all 9 Codacy Agentlinter
findings on `AGENTS.md` without changing the meaning of any rule or weakening any boundary, plus
one supporting rule in `docs/agents/contributing.md` to keep the new "Last updated" line honest.

## Context
A previous pass (#112) introduced some of the wording now flagged ("always … with no
exceptions", "unless the user explicitly asks otherwise in the conversation"). The fixes below
make each exception concrete instead of re-shuffling vague wording. `CLAUDE.md` is explicitly
out of scope (owned by its own issue).

## Implementation Steps

### Step 1 — Rewrite the flagged passages in `AGENTS.md`
Apply each change below; keep the surrounding text and line wrapping (~100 columns) otherwise
intact.

1. **Last updated line** — directly under `# Project Instructions`, add
   `_Last updated: YYYY-MM-DD_` using the date the change is committed (update it again if the
   PR is revised on a later day).
2. **Acronyms** — line ~9: "each user's own browser IP absorbs…" → "each user's own browser IP
   (Internet Protocol) address absorbs…". Line ~20: "ES Modules" → "ECMAScript (ES) Modules".
3. **Backend-module sentence (line ~28)** — convert the code-spanned paths to links and make the
   exception concrete, e.g.:
   "Only the Auth module exists so far — the tracked-repo/label-rule data model is still an open
   product decision (see [Product Definitions](docs/agents/product.md)). See
   [Backend Architecture](docs/agents/architecture/backend.md) for the module classification
   (Core/Always-on/Lazy) and inter-module communication guidelines. A new module must follow
   them unless its issue or plan explicitly documents why it deviates."
4. **Frontend paragraph (line ~39)** — `` `docs/agents/architecture/frontend.md` `` →
   `[Frontend Architecture](docs/agents/architecture/frontend.md)`.
5. **Host-tooling rule (lines ~68–72)** — replace both "(unless the user explicitly asks
   otherwise in the conversation)" occurrences with one concrete exception, e.g.:
   "**Always run project commands through `docker-compose`.** Never install packages or invoke
   tooling (`yarn`, `npm`, `php`, etc.) directly on the host machine. The only exception is when
   the user explicitly allows running a specific command on the host — either in their message in
   the current conversation, or through a standing user instruction (for example a user memory
   entry or a `CLAUDE.md` override). The host may not even have the required runtime installed,
   and dependencies must stay reproducible inside the project's containers. Examples:"
6. **English rule (line ~81)** — "All documentation and code comments must always be written in
   **English**, with no exceptions." → "All documentation and code comments must be written in
   **English**, with no exceptions — even when the user writes in another language."
7. **Backend source bullet (line ~85)** — `` see `docs/agents/architecture/backend.md` `` →
   `see [Backend Architecture](docs/agents/architecture/backend.md)`.

Leave as-is: directory labels used as headings (`` ### Issues (`docs/agents/issues/`) ``,
`` ### Plans (`docs/agents/plans/`) ``), the naming-convention code blocks, and the
`` `docs/agents/` `` mentions inside the documentation table descriptions — these are labels, not
cross-references to a file. Do not touch the "Keep backend controllers thin" and "Don't add
GitHub credential storage" rules (not flagged; mirrored in `CLAUDE.md`).

### Step 2 — Add the "Last updated" maintenance rule to `docs/agents/contributing.md`
Under `## Pull Requests`, add a bullet, e.g.:
"- **`AGENTS.md` Last updated date:** Every PR that changes `AGENTS.md` must also bump its
  `_Last updated: YYYY-MM-DD_` line to the date of the change. A stale date misleads agents about
  how current the instructions are."

## Files to Change
- `AGENTS.md` — acronym expansions, concrete exceptions for the host-tooling / backend-module
  rules, English-rule edge case, doc paths converted to Markdown links, new "Last updated" line.
- `docs/agents/contributing.md` — new PR rule requiring the `AGENTS.md` date bump.

## Notes
- Verification is post-merge only: Codacy's re-analysis of `main` should no longer report the 9
  findings. No local command reproduces Agentlinter.
- Codacy's line numbers shift once the "Last updated" line is added — match findings by content,
  not line number.
- Re-read every rewritten sentence against its original to confirm no rule became looser (the
  issue's hard requirement).
- `CLAUDE.md` duplicates the host-tooling rule with the old wording; leave it — it is owned by a
  separate issue.
