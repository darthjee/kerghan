# Narrow the infra agent

Update `.claude/agents/infra.md` to state the new boundary:

- `description`: add "Delegate standalone/Vault distribution tasks (`standalone/`,
  `dockerfiles/kerghan_standalone/`) to the standalone agent."
- `## Your scope`: change the `dockerfiles/` line to exclude `dockerfiles/kerghan_standalone/`;
  state that the release jobs for the standalone image (`.circleci/config.yml`), `bin/image.sh`
  and `scripts/deploy.sh` remain `infra`'s.
- "Do NOT touch" paragraph: add `standalone/` and `dockerfiles/kerghan_standalone/` (delegate to
  the `standalone` agent).
- If `infra` needs the standalone specs (#339–#341, #343), reference them only via the
  "Standalone distribution" entry in `docs/agents/specs.md`, never `docs/agents/specs/standalone/`.

## Files to Change

- `.claude/agents/infra.md` — description, scope and boundary text.
