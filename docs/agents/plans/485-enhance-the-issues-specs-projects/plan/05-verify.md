# Verify

Documentation only, so verification is a read-through plus a few greps. Run from the repository root.

- Links: every relative link in the edited files resolves, including `../issues.md` and the `#open-questions` anchors used by the index (`grep -n "open-questions" docs/agents/specs/issues.md`, then confirm each anchor exists in its file).
- Open questions: every remaining `- [ ]` item in `docs/agents/specs/issues/*.md` ends with an owner in parentheses, and every owner is one of #486 to #494 (`grep -rn "^- \[ \]" docs/agents/specs/issues/ | grep -v "(#4[89][0-9])"` returns nothing). `projects.md` has none, and its `## Not decided` items have a reason each.
- Required tests: each rule in `projects.md` has a matching line in its `## Required tests`, which is still the last section of every file.
- Consistency: grep the specs for "one repository" and "several projects" and make sure no file still treats the cardinality as open or contradicts it; `grep -rni "github project" docs/agents/specs` only uses the full capitalized form for the GitHub feature.
- Content rules: no real tokens, secrets, personal data or private repository names (`grep -rnEi "ghp_|github_pat|secret|token" docs/agents/specs` should only match prose about credentials).
- Scope: `git status` shows only files under `docs/agents/specs/` (plus the plan and issue files already committed); no code, migrations, endpoints or permanent docs changed.

Fix anything found in the file that owns it.

## Files to Change
- None expected; fixes go to whichever spec file the check flags.
