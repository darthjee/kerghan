# Security static spec and docs

## Security specs

- **S1, static.** A spec reads every file under `components/resources/projects/` (and `components/common/confirmModal/`) and fails on `dangerouslySetInnerHTML`. Render specs check that names and descriptions containing `<b>x</b>` show as literal text.
- **S3.** Already covered by steps 01, 02, 06 and 07. Add one cross-check that `#/projects/..%2Fadmin` resolves to the project route with an id that fails the uuid guard, so no fetch is made.
- **S4.** Covered by the dirty-form guard spec. Also add a spy check that the project forms never call `localStorage` or `sessionStorage` `setItem`.
- **S5.** No integration or credential text appears on project screens. `GITHUB_UNAVAILABLE` uses generic wording.

## Docs

- **`docs/agents/architecture/frontend.md`.** Document:
  - the `projects` module layout
  - the seven routes, and which issue screens are still a placeholder
  - `ApiError.meta`
  - `ConfirmModal`
  - the dirty-form guard
- **`docs/agents/specs/issues.md`.** Align the implementation table's row for #560 with the issue's *Builds against* list by adding `ui/states.md` and `testing.md#frontend-tests`.

## Files to Change
- `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js` (new)
- `docs/agents/architecture/frontend.md`
- `docs/agents/specs/issues.md`: the implementation table row
