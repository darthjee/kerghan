# Standalone review and PR description

Dispatch the standalone agent to review, read-only, the parts that touch existing behaviour:

- The command and flag lists in `completion.md` match `standalone/bin/kerghan`.
- The `configure` syntax (`KEY=VALUE`, `KEY=-`, `--unset`, env keys) is right.
- The bash 3.2 constraints are right.
- `install.md` keeps the installer's `update` contract (no prompts, no sudo, `mv -f`, never fatal) and fits `install.sh`'s flow.

Fix any finding in the spec. In the PR description:

- Any #424 decision adjusted to match the client's current behaviour.
- The list of open markers left for #426, #427 and #428.
- Confirmation that no code changed.

## Files to Change
- `docs/agents/specs/auto-complete/*.md` — fixes from the review, if any.
