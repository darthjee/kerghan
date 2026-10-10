# Update the agent lists

Register the `standalone` agent wherever the roster is maintained:

- `AGENTS.md` "Specialist agents": add `standalone` to the roster list.
- `.claude/agents/architect.md` agent table: add a row
  `| \`standalone\` | \`standalone/\`, \`dockerfiles/kerghan_standalone/Dockerfile\` — Vault-based standalone distribution (inner compose stack, client CLI, installer) |`
  and change the `infra` row's `dockerfiles/` to note the `kerghan_standalone` exception.
  Roster row only — no new coordination/routing rules.
- `docs/agents/external.md` Vault entry: replace "Consulted by the `infra` agent for
  Docker/deployment changes involving Vault" with the `standalone` agent as its consumer.

## Files to Change

- `AGENTS.md` — roster list.
- `.claude/agents/architect.md` — agent table.
- `docs/agents/external.md` — Vault entry's consuming agent.
