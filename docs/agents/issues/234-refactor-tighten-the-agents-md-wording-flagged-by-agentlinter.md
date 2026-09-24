# Issue: Refactor: Tighten the AGENTS.md wording flagged by Agentlinter

## Description
Codacy's Agentlinter reports 9 clarity/structure findings on the agent instruction file `AGENTS.md`. Several of them target wording introduced by the earlier Agentlinter pass (#112), so this issue must avoid trading one set of findings for another.

## Problem
`AGENTS.md` — 9 findings (line numbers as reported by Codacy on `main`):

- `:9` undefined acronym "IP" (in "browser IP"); `:20` undefined acronym "ES" (in "ES Modules") — Info/Warning
- `:28`, `:71`, `:81` — absolute rule without an escape hatch (Warning). `:81` is "All documentation and code comments must always be written in **English**, with no exceptions."; `:69`–`:72` is the "never install packages / invoke tooling on the host" rule; `:28` is the backend-module-guidelines sentence
- `:69` vague instruction; `:70` vague conditional "unless the user explicitly asks otherwise in the conversation" (Warning/Info)
- `:1` cross-reference to `docs/agents/product.md` "not found in any file" — the file exists; the linter likely does not follow the code-spanned path used on `:28`
- `:1` no version/update date (Info)

## Expected Behavior
The instructions read the same to a human and to an agent: **the meaning of every rule is unchanged and no boundary is weakened.**

## Solution
- Expand the two acronyms on first use ("browser IP (Internet Protocol) address", "ECMAScript (ES) Modules").
- Host-tooling rule (`:68`–`:72`): replace the vague "unless the user explicitly asks otherwise in the conversation" with a concrete exception that names both accepted sources of an override: an explicit request in the user's message in the current conversation, **or** a standing user instruction (e.g. a user memory entry or a `CLAUDE.md` override) that explicitly allows running that command on the host.
- English rule (`:81`): keep it absolute, but make the edge case explicit instead of adding an escape hatch — e.g. "All documentation and code comments must be written in **English**, with no exceptions — even when the user writes in another language."
- Backend-module-guidelines sentence (`:28`): state its exception explicitly (an explicit, documented decision to deviate) in concrete terms.
- Convert **every** code-spanned doc path in `AGENTS.md` into a Markdown link, for consistency — including `docs/agents/product.md` and `docs/agents/architecture/backend.md` (`:28`), `docs/agents/architecture/frontend.md` (`:39`), and `docs/agents/architecture/backend.md` (`:85`). Directory mentions used as labels (e.g. the `docs/agents/issues/` / `docs/agents/plans/` headings and the naming-convention code blocks) stay as-is.
- Update date: add a "Last updated" line near the top of `AGENTS.md` (e.g. `_Last updated: YYYY-MM-DD_`, set to the merge date of this change), and add a rule to `docs/agents/contributing.md` stating that any PR touching `AGENTS.md` must bump that date. No CI enforcement for now.
- Do not edit `CLAUDE.md` here (owned by its own issue).

## Benefits
Removes all 9 findings and makes the exceptions to hard rules explicit.

## Verification

- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem** (except any deliberately left open and called out in the PR).

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
