# Verify links and dry-run the agents

Follow the issue's Testing strategy.

1. **Link check**: every doc path and `#anchor` named in `.claude/agents/security.md`,
   `.claude/agents/data-access.md` and the new `.claude/agents/architect.md` section resolves
   (file exists; anchor matches a heading slug). Fix any that do not.
2. **Dry run**: invoke the refreshed `security` and `data-access` agents on the merged Repositories
   implementation (#444 — find its PR and changed files with `gh`). Confirm that
   `Rules consulted:` lists `docs/agents/modules/repositories.md` (`## Security`) and
   `docs/agents/architecture/security.md`, that both reports use the extended format, and that
   nothing is reported that the documented rules already allow. If a report shows a discovery miss
   or a false finding caused by the agent text, adjust the agent and re-run.
3. **Evidence**: paste both reports into the PR description. Do not commit them. Real findings in
   the Repositories code are out of scope here — list them in the PR description as follow-up
   candidates.

## Files to Change
- None beyond fixes to the files of steps 01–04 that the checks call for.
