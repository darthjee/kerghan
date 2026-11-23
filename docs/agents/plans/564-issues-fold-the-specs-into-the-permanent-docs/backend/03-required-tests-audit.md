# Audit the backend Required tests and fill gaps

For every `## Required tests` section of the spec files that a backend tier owns (as `testing.md#tiers` and *Coverage per area* say): `model.md`, `projects.md`, `github-link.md`, `sync.md`, `security.md`, `edge-cases.md`, `testing.md`, `api.md` and `api/*.md`. Find the spec under `backend/src/` that implements each test, on the tier given (unit, DB-backed `*.db-spec.ts`, race or restart). Use the E-ids and the spec titles to match.

- Implemented: record it.
- Missing, or on the wrong tier: add it in the module's existing spec style, with the builders, the injected `Clock` and the intruder user from `testing.md#fixtures`.
- Cannot be added without a product decision: do not add it. Report it as a gap.

Hand the architect the list (Required test, spec file, tier, added: yes or no) for `modules/issues/required-tests.md`.

## Files to Change

- New or extended specs under `backend/src/issues/tests/` or `backend/src/integrations/tests/`, only where the audit finds a gap.
