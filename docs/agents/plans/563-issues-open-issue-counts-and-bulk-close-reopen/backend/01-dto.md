# DTO and input type

Add `BulkIssueStateDto`, following `api/errors-and-validation.md`:

- `issueIds` is required. It must be an array (`IsArray`) of 1 to 100 items (`ArrayMinSize(1)`, `ArrayMaxSize(100)`). Each item must be a string and a uuid, using the same uuid check the module already uses for path ids.
- A custom validator rejects duplicates, comparing the ids lowercased. Never deduplicate them.
- `state` is required and must be `open` or `closed` (`IsIn`). There is no default.
- `null`, a wrong type, an empty array and a non-string item all answer `400 VALIDATION_FAILED`.

Add `toBulkIssueStateInput(dto)`, which lowercases the ids and keeps their order, and the matching `BulkIssueStateInput` type. Cover every row with unit specs in `issue-dtos.spec.ts`. Include the boundaries: 100 ids pass and 101 fail, and `A…` with `a…` counts as a duplicate.

## Files to Change

- `backend/src/issues/dto/bulk-issue-state.dto.ts`: new DTO and `toBulkIssueStateInput`
- `backend/src/issues/types/issues-api.types.ts`: `BulkIssueStateInput`, `BulkIssueStateResponse`
- `backend/src/issues/tests/issue-dtos.spec.ts`: the validation rows
