# Frontend Plan: Issues: fold the specs into the permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

- Repoint with the mapping table in [plan.md](plan.md#shared-contracts). Anchors are unchanged.
- Report the audit to the architect as a list: each frontend Required test, the spec file that covers it, and any test added.

## Implementation Steps

### Step 1 — Repoint the spec references

Rewrite the `docs/agents/specs/issues/api/...` paths in comments, keeping the anchors:

- `frontend/assets/js/client/IssuesClient.js` (line 30): `api/issues.md` and `api/github-link.md` become `backend/routes/issues/issues.md` and `backend/routes/issues/github-link.md`.
- `frontend/assets/js/client/ProjectsClient.js` (line 17): becomes `backend/routes/issues/projects.md`.
- `frontend/specs/support/issuesBuilders.js` (lines 8 and 47): become `backend/routes/issues/projects.md` and `backend/routes/issues/github-link.md`.

Afterwards, `git grep -n "specs/issues" -- frontend` prints nothing.

### Step 2 — Audit the frontend Required tests and fill gaps

For the Required tests that `testing.md#frontend-tests` puts in the frontend tier, find the Jasmine spec under `frontend/specs/` that implements each one. That covers `ui.md#required-tests` (Lists, Issue page and forms, Linking, States, Re-reading, and the U-ids), the frontend rows of `security.md#required-tests` (the `IssueBody` rendering table, S1 to S5), and the counts and bulk rows from #563. Match them by U-id, E-id, S-id and spec title.

- Implemented: record it.
- Missing: add it in the existing spec style, with `issuesBuilders.js`, `fetchSequence.js`, `fakeWindow.js` and the fake clock.
- Needs a product decision: report it as a gap and do not add it.

Hand the architect the list (Required test, spec file, added: yes or no).

## Files to Change

- `frontend/assets/js/client/IssuesClient.js`, `frontend/assets/js/client/ProjectsClient.js`, `frontend/specs/support/issuesBuilders.js`: comment paths.
- New or extended specs under `frontend/specs/`, only where the audit finds a gap.

## CI Checks

- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Never run `yarn` on the host; always use docker-compose.
