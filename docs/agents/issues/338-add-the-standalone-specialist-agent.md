# Issue: Add the standalone specialist agent

## Description

Part of epic #336 (standalone distribution). Before any standalone code is written, add a new
specialist agent, `standalone`, that owns the Vault-based standalone distribution of Kerghan
(`darthjee/kerghan-standalone`). Depends on #337 (standalone specs, merged).

## Problem

Upcoming sub-issues #342 and #344 are owned by a `standalone` agent that does not exist yet.
Today the `infra` agent claims all of `dockerfiles/` and is the documented consumer of the Vault
guide (`docs/agents/external.md`), so standalone work would be routed to `infra` by default,
blurring the boundary the specs define (README "Repo layout").

## Expected Behavior

- `.claude/agents/standalone.md` exists, following the format of the existing agents
  (frontmatter `name`/`description`/`tools: Read, Edit, Write, Bash`, a "Your scope" section,
  explicit "Do NOT touch" boundaries, and the no-host-tooling rule).
- Its scope is exactly the `standalone` rows of the specs' "Repo layout" table:
  - `standalone/vault/` (inner compose file and `tent/` standalone configuration);
  - `standalone/bin/kerghan` (the client CLI);
  - `standalone/install.sh`;
  - `standalone/kerghan.env.example`;
  - `dockerfiles/kerghan_standalone/Dockerfile`;
  - how Vault is used.
- Its description is specific enough that standalone/Vault work is routed to it, not to `infra`.
- Boundary: `.circleci/config.yml`, `bin/image.sh` and `scripts/deploy.sh` (release jobs and the
  Render deploy) stay with `infra`.
- Doc links: the agent consults the Vault guide and the standalone specs, linking to the specs
  **only through the specs hub** ("Standalone distribution" entry in `docs/agents/specs.md`),
  never directly to `docs/agents/specs/standalone/`, so deleting the specs folder (#348) never
  requires touching agent files. The same rule applies to the `infra` agent.

## Solution

- Create `.claude/agents/standalone.md`.
- Update `.claude/agents/infra.md` (body and `description`): carve `dockerfiles/kerghan_standalone/`
  out of its `dockerfiles/` scope, state the CircleCI / `bin/image.sh` / `scripts/deploy.sh`
  boundary, and delegate standalone/Vault work to the `standalone` agent.
- Update every agent list:
  - `AGENTS.md` "Specialist agents" roster;
  - `.claude/agents/architect.md` agent table (roster row only — no new delegation/routing
    rules).
- Repoint the Vault entry in `docs/agents/external.md` from the `infra` agent to the
  `standalone` agent as its consumer.
- Not in scope: `docs/agents/folder-structure.md`, `architecture/infra.md` and the README —
  that permanent content is folded in by #347 once the code exists.

**Owner:** architect

## Benefits

- Standalone sub-issues (#342, #344) have a defined owner before implementation starts.
- Clear `infra` / `standalone` boundary avoids both agents editing the same files.
- Hub-only spec links keep the spec-folder deletion (#348) a one-place change.
