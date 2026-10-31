# Consistency pass
Re-read the issue's Solution and check every decision lands in exactly one owning file (others
cross-link instead of repeating). Check every relative link resolves. Check the stated current
client behavior against `standalone/bin/kerghan` (validators, `DEFAULT_ENV_KEYS`, exit codes,
hint texts); where a decision conflicts with it, adjust the spec and list the change for the PR
description.

## Files to Change
- `docs/agents/specs/client-config/*.md` — fixes from the pass, if any.
