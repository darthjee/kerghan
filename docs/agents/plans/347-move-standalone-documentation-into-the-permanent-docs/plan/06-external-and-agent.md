# Update external.md and the standalone agent

- `docs/agents/external.md`: change the Vault entry to say that Kerghan uses Vault as the base of
  `darthjee/kerghan-standalone`, and link to `standalone.md`. Remove "Not used by Kerghan yet;
  planned for upcoming deployment work."
- `.claude/agents/standalone.md`:
  - Scope: replace `standalone/kerghan.env.example` (never shipped) with
    `standalone/config.example` (the example `~/.kerghan/config` shipped as a release asset), and
    add `standalone/scripts/` and `standalone/test/` if they are missing.
  - Remove "Some of these paths may not exist yet…": they all exist now.
  - References: add `docs/agents/standalone.md` as the primary reference and
    `environment-variables.md` "Standalone" for the env contract. Remove the specs-hub bullet:
    after #348 there will be no standalone spec to reach.
  - Also fix "env example" in the frontmatter `description`, so it reads "config example".

## Files to Change

- `docs/agents/external.md` — Vault is used
- `.claude/agents/standalone.md` — scope and references
