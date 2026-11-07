# Consistency pass and agent review

1. **Open markers table:** collect every `> **Open — settled by #NNN:**` callout from the six files and fill the README "Open markers" table (file + anchor, decision, settling issue). Check every marker's issue is one of #446–#451 and every #446–#451 owns at least one marker.
2. **Consistency:** the same names everywhere (table/column names, statuses, route purposes, source statuses); no decision recorded in two files with different wording — link instead.
3. **Links:** every relative link in `docs/agents/specs/repos/` and the new `docs/agents/specs.md` entry resolves (`ls` each target).
4. **Scope check:** `git diff --stat origin/main` shows only `docs/agents/specs.md` and `docs/agents/specs/repos/*` (plus this issue's plan/issue files).
5. **Review:** spawn the **product-owner**, **security** and **data-access** agents (read-only) on `docs/agents/specs/repos/`. For each finding, either fix the specs or record it as an open marker owned by the right sub-issue (#446–#451) and add it to the table.

## Files to Change
- `docs/agents/specs/repos/README.md` — "Open markers" table.
- Any spec file touched by review findings.
