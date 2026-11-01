# Consistency pass and standalone review

Check the whole spec folder against #414 and #415:

- Every decision and edge case from #414 (scope, behaviour decisions, edge cases 1–15, backward compatibility 1–7, performance & security 1–12) and #415 (settled decisions, additional edge cases 1–12) appears in exactly one spec file, the one named in the issue's layout, with cross-links instead of duplication.
- Messages, flag names, key names and values are identical across files.
- Relative links and anchors resolve, and the README index lists every file.

Then ask the standalone agent to review, in this same PR, the parts that touch the client's existing behaviour: the config parser and validation conventions, the wizard order, `cmd_update_env` reuse, `up`'s upgrade, downgrade and non-release-image logic, and the installer contract. Apply its corrections. If a decision from #414 or #415 had to change, list it in the PR description; do not edit other issue bodies.

The PR description must also confirm that no installer sub-issue is needed (or name the blocker).

## Files to Change
- `docs/agents/specs/client-update/*.md` — fixes from the consistency pass and the review.
