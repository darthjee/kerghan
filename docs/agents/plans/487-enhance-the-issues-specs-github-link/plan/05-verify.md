# Verify links, ids and open questions

Documentation-only checks, run with `grep` and by reading the files:

- Every relative link and anchor added or changed resolves (`github-link.md`, `projects.md`, `api.md`, `model.md`, `sync.md`, `ui.md`, `security.md`, `testing.md`, `edge-cases.md`, `specs/issues.md`).
- `grep -rn "#487" docs/agents/specs` shows no remaining "#487 decides" or "(#487)" owner for a question this issue closed; remaining mentions name #487 only as the issue that fixed a rule.
- `grep -n "E5[7-9]\|E6[0-4]" docs/agents/specs/issues/*.md` finds each new id in `edge-cases.md` and in the files that cite it; no id is duplicated or skipped; the "Row ids" bullet reads `E1…E64`.
- Each spec file's "Open questions" lists only questions with an owner or a stated reason; `github-link.md` has none owned by #487.
- The "Required tests" of `github-link.md`, `projects.md` and `edge-cases.md` match the rules.
- The diff touches only `docs/agents/` (no code, migrations, endpoints, `CLAUDE.md` or `AGENTS.md`).

## Files to Change
- None (verification only; fix any finding in the file it belongs to).
