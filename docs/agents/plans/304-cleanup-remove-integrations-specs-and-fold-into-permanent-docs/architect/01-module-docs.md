# Write the integrations module docs

Create `docs/agents/modules/integrations.md`, following the shape of `modules/auth.md` and
`modules/mail.md`, with these top-level sections:

- `## Overview`: what an integration is (`provider`, `type`, label, many per user), why it
  exists, and that the backend never exposes secrets to the browser. Also cover how the module
  is classified under `architecture/modular-pattern.md`. Source: spec `README.md`.
- `## Data model`: the storage model, tables, `### \`integrations\` columns`,
  `### Owner foreign key`, constraints, `### Status lifecycle` (transitions, expiry), edge
  cases, the lockout table and migrations. Source: `model.md`.
- `## Security`: `### Access rules`, `### Encryption at rest` (AAD binding, key, key id),
  `### Secrets never logged`, `### Create and replace credential: failure cool-off`,
  `### Test connection cooldown`, and faking GitHub in tests. Source: `security.md`. These
  headings must keep their exact text so the anchors in the shared contract work.
- `## Type contract`: the strategy interface, flow kind, redirect-flow invariants, validate,
  test, describe, mask, delete behavior, status reason codes, registration, and what a new
  type doc must contain. Source: `type-contract.md`.
- `## Frontend`: the "My account" menu item, the Integrations page, list columns, actions, the
  type picker and credential input rules. Source: `ui.md`.
- `## Types`: links to the three per-type files.

Create `docs/agents/modules/integrations/pat.md`, `oauth-app.md` and `github-app.md`, one per
`specs/integrations/types/*.md`. Keep every section except "Required tests" and "Manual smoke
check". Keep the heading texts so the anchors stay the same (`#flow`, `#routes`, `#landing`,
`#state`, `#revocation`, `#validate--create`, `#selection`, `#user-token`). Fold the per-type
"UI guidance" into each file under a `## Frontend` heading. Fix relative links, since the
files are now one level deeper than `modules/`.

## Files to Change
- `docs/agents/modules/integrations.md`: new
- `docs/agents/modules/integrations/pat.md`: new
- `docs/agents/modules/integrations/oauth-app.md`: new
- `docs/agents/modules/integrations/github-app.md`: new
