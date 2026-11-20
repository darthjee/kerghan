# Rewrite the product-owner agent

Rewrite `.claude/agents/product-owner.md`. It stays read-only (`tools: Read, Bash`) and restates no product rules. Structure:

1. **Frontmatter `description`**: consult **before planning** when an issue introduces a new entity, endpoint, access rule or user-facing feature, or touches a deferred or still-open area. Read-only, returns verdicts.
2. **Intro**: role (Product Owner for Kerghan, read-only, never edits). Drop the reference to Majora's product-owner agent.
3. **Reading order** (always, before answering):
   1. All of `docs/agents/product.md`, plus `docs/agents/flow.md`.
   2. The "Active specs" list in `docs/agents/specs.md`. This is the authority on which specs are active, not the map.
   3. For a question touching an active spec's feature: that spec's index and only the concern files the question is about.
4. **Precedence**:
   - Within its feature's scope, an active spec overrides `product.md`. Answer from the spec and note that `product.md` will be rewritten when the spec is folded in.
   - Outside an active spec's scope, `product.md` alone applies.
   - A conflict the spec doesn't acknowledge (it neither names the overridden statement nor lists it to rewrite at fold time) is a "doc conflict", sent to the architect. Never pick a winner.
   - Completed specs are never read.
5. **Map of decided areas**: the table from the issue's "Decided areas" section, with links only. Rows: Accounts and login (with device authorization, GitHub handle, admin-only tools), Default user, User approval, Integrations, Repositories, Issues and Projects (active spec), Standalone distribution, Deferred, Still open. Check each path exists. State that `product.md` and active specs are the only sources, and that the map is a shortcut.
6. **Verdicts**: all lowercase and in quotes: "decided", "decided in active spec", "deferred", "undecided — needs product decision", "no documented rule", "doc conflict". For each, say when it applies and what the answer must include (doc and section; the fold note; the Deferred entry; the open item; what was searched; both quotes). Spell the two shared verdicts exactly as `data-access.md` does.
7. **Answer format**: verdict first, then doc references. One verdict per part of a multi-part question. Never fill a gap with a default ruling.
8. **Edge cases**: the seven from the issue (mixed parts; spec partly built — rule on decisions, never read code; an issue contradicting a decided rule — "decided" plus the quoted rule, routed to the user; stale map row — fall back to `product.md` links and add a `Notes:` "agent definition stale: map row X"; Deferred/spec carve-out — the spec's explicit carve-out decides; two active specs disagreeing — "doc conflict"; not a product question — no verdict, return to the architect).
9. **"When the architect invokes you"**: rewritten around the verdicts. "undecided — needs product decision" now only covers label rules, org-wide tracking and what depends on them.

## Files to Change

- `.claude/agents/product-owner.md`: full rewrite as above.
