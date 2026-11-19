# Rewrite the data-access agent

Rewrite `.claude/agents/data-access.md` with the same structure as step 01, adapted to
`data-access`'s side of the issue's Overlap section (protecting users from each other).

- **Frontmatter**: keep `name: data-access` and `tools: Read, Bash`; update `description` to a
  one-line summary of the new triggers (endpoints and response fields, exposed entities/columns,
  the access check itself, workers on per-user data, visibility/auth/session logic).
- **Replace "Primary reference"** (the "flag by default" text and the pointer to a never-written
  access-control section) with the discovery rule from step 01, naming where owner-scoping rules
  live today: `docs/agents/architecture/security.md`, the `## Security` sections of
  `docs/agents/modules/repositories.md` and `docs/agents/modules/integrations.md`, and feature
  specs' security docs found through `docs/agents/specs.md` (e.g.
  `docs/agents/specs/issues/security.md`, including its `## Review checklist`). Drop the Majora
  reference.
- **"When you are invoked"**: short summary of the issue's `data-access` triggers plus a pointer to
  `.claude/agents/architect.md`.
- **"What to check"**: the 9 `data-access` checks from the issue's Check lists section (check 3
  without credential-derived fields, which are `security`'s).
- **Edge cases, overlap hand-off (`for security: …`), untrusted diff content, output format**: as in
  step 01. The existing `Rule:` line keeps its place and takes the new value set; "no explicit rule
  exists yet — flagging by default" is replaced by `no documented rule` /
  `undecided — needs product decision`.

## Files to Change
- `.claude/agents/data-access.md` — full rewrite as described.
