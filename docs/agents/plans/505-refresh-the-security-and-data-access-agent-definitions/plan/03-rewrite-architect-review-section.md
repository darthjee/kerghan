# Rewrite the architect's review section

In `.claude/agents/architect.md`, replace the "### Security review" section with
"### Security and access-control review" holding the full trigger lists from the issue's Invocation
triggers section:

- The nine `security` triggers and the five `data-access` triggers.
- Dispatch: both agents run in parallel after the specialist (`backend`, `frontend`, `infra`,
  `proxy` or `standalone`) finishes; corrections go to the responsible specialist; both are
  re-invoked until they report CLEAN.
- Drop the stale text ("no GitHub credentials/OAuth yet", "`backend` for Express code").
- Note that `Notes:` entries (hand-offs, missing `## Security` sections, "agent definition stale")
  do not block a merge but may call for follow-up; "undecided — needs product decision" findings go
  to the user.
- One line pointing at the maintenance rule's Definition of Done bullet in
  `docs/agents/contributing.md` (step 04), instead of repeating it.

Leave the "### Cache warm-up review" section unchanged.

## Files to Change
- `.claude/agents/architect.md` — rewrite the "Security review" section as described.
