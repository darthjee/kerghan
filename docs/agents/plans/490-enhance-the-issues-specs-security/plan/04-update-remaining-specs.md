# Update testing.md, edge-cases.md, ui.md and issues.md

**testing.md**

- Security verification: add the content canary (project name, description, issue title and body, repository owner/name) next to the credential canary; reference the review checklist of `security.md`.
- Frontend tests: the static spec extends to bodies (no `dangerouslySetInnerHTML`, no raw-HTML plugin); the rendering unit specs per rule.
- Close the "(#490)" open question.

**edge-cases.md**

- E13: the per-link dedupe is mandatory; correctness still does not depend on it.
- Any row stating that a deleted project's issues remain is updated to the hard delete.
- Close any #490 open question.

**ui.md**

- Bodies render through the shared `IssueBody` component under the rules of `security.md`; titles and descriptions as text.
- Inputs for #491: the caps' and rate limits' refusals need wording.

**issues.md**

- The index row for `security.md` reads decided.

## Files to Change

- `docs/agents/specs/issues/testing.md` — content canary, frontend specs, open question.
- `docs/agents/specs/issues/edge-cases.md` — E13, deletion rows.
- `docs/agents/specs/issues/ui.md` — shared body component, inputs for #491.
- `docs/agents/specs.md`-linked index `docs/agents/specs/issues.md` — status.
