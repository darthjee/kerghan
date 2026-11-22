# DTOs

Add the three bodies with strict types, so no value is coerced and unknown properties are stripped. Follow `api/errors-and-validation.md#input-validation`.

- `ImportIssueDto`: `number`, a required integer from 1 to 2147483647. `"12"`, `1.5`, `0` and `null` are rejected.
- `AttachIssueDto`: `number`, with the same rule. `confirmUpdatedAt` is optional: an ISO 8601 UTC string with milliseconds, as `updatedAt` returns it, parsed to a `Date` and compared as an instant. A malformed value answers `400`.
- `UnlinkIssueDto`: `discardUnsentChanges`, an optional strict boolean. Only `true` discards, and `"true"` is rejected.

Add the typed service inputs (`ImportIssueInput`, `AttachIssueInput`, `UnlinkIssueInput`) and the unlink wire shape `{ issue: IssueResponse, droppedUnsentChanges: boolean }` to `types/issues-api.types.ts`.

## Files to Change
- `backend/src/issues/dto/import-issue.dto.ts`, `attach-issue.dto.ts` and `unlink-issue.dto.ts`: new.
- `backend/src/issues/types/issues-api.types.ts`: the inputs and the unlink response.
- `backend/src/issues/tests/issue-dtos.spec.ts`: the boundary cases (1, 2147483647, 0, 2147483648, `"1"`, `1.5`, `null`), a malformed or non-millisecond `confirmUpdatedAt`, and `discardUnsentChanges` set to `"true"` or `1`.
