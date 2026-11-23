# Delete the specs and complete the entry

Do this only after backend has repointed `edge-cases.coverage.spec.ts`, and after backend and frontend have repointed their comments.

1. Delete `docs/agents/specs/issues.md` and `docs/agents/specs/issues/` with `git rm -r`.
2. In `docs/agents/specs.md`:
   - Under *Active specs*, replace the entry with "None.".
   - Add a *Completed specs* row "Issues and Projects (projects, Kerghan issues, two-way sync with linked GitHub issues)". In the style of the Repositories row, it lists `modules/issues.md` and every page, `backend/routes/issues.md` and its pages, `product.md#issues-and-projects`, `architecture/security.md`, `environment-variables.md`, `flow.md` and `modules/repositories.md` (the removal rule), with product decision #483.
   - The *Conventions* bullet that names Issues and Projects as the index-file-beside-folder example: keep the convention and reword the example in the past tense ("used by Issues and Projects").
3. Run the final sweep from the repository root:

   ```bash
   git grep -n "specs/issues" -- . ':!docs/agents/issues' ':!docs/agents/plans'
   ```

   It must print nothing. Then check that every relative link in the new pages resolves. A quick script over `docs/agents/modules/issues*` and `docs/agents/backend/routes/issues*` that resolves each `](...)` target is enough; run it with the host shell's `grep`/`test`, not a language runtime.

## Files to Change

- `docs/agents/specs/issues.md`, `docs/agents/specs/issues/`: deleted.
- `docs/agents/specs.md`: *Active specs*, *Completed specs* and the Conventions example.
