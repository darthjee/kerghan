# Issue DTOs and field rules

Build the request DTOs with class-validator, following the project DTOs (`dto/list-projects.dto.ts`, `dto/edit-project.dto.ts`). Types are strict, unknown properties are stripped, and lengths count code points (`MaxCodePoints` / `MinCodePoints` from `core/code-points.validator.ts`).

## `dto/issue-fields.ts`

- `MAX_TITLE_CODE_POINTS = 256` and `MAX_BODY_CODE_POINTS = 65536`.
- `normalizeBody(body: string | null | undefined): string | null`:
  - exactly `''` or `null` becomes `null`;
  - every other string is kept as-is, so it is **not trimmed** and a whitespace-only body stays.
  - This is the single normalization function `sync.md#fields-and-ownership` asks for, so #557 and #558 import it for GitHub values.
- The `IssueState` values (`open`, `closed`) are re-used from `entities/issue.entity.ts`.

## DTOs

| DTO | Field rules |
|---|---|
| `CreateIssueDto` | `title`: required, `trimString`, `IsString`, 1–256 code points after trim. `body`: optional, `IsString` or `null`, ≤ 65536 code points, no trim. `state`: optional, `IsIn(['open','closed'])`, default `open`. |
| `EditIssueDto` | `title`: optional, but `null` rejected (the same `ValidateIf(value !== undefined)` pattern as `EditProjectDto.name`), trimmed, 1–256. `body`: optional, string or `null`, ≤ 65536, no trim. `state`: optional, `open` or `closed`, `null` rejected. |
| `ListIssuesDto` | `page` ≥ 1 (default 1); `perPage` 1–100 (default 50); `state` one of `open`/`closed`/`all` (default `open`); `search` trimmed, ≤ 100 code points, default `''`. Reuse `MAX_PER_PAGE` and `MAX_SEARCH_CODE_POINTS` from `list-projects.dto.ts`. If importing them reads oddly, move them to a shared `dto/listing-fields.ts`. |

Each DTO has a `to…Input` mapper into typed inputs, in a new `types/issues-api.types.ts`:

- `CreateIssueInput { title, body: string | null, state }`;
- `EditIssueInput { title?, body?: string | null, state? }`, where an absent member stays absent and `body` goes through `normalizeBody`;
- `ListIssuesInput { page, perPage, state: 'open' | 'closed' | 'all', search }`.

## Files to Change

- `backend/src/issues/dto/issue-fields.ts` — the limits and `normalizeBody`.
- `backend/src/issues/dto/create-issue.dto.ts`, `dto/edit-issue.dto.ts`, `dto/list-issues.dto.ts` — the DTOs and mappers.
- `backend/src/issues/types/issues-api.types.ts` — the service inputs.
- `backend/src/issues/tests/issue-dtos.spec.ts` — the validation table:
  - wrong types (`"1"`, `"true"`) rejected;
  - `null` title rejected on edit;
  - blank title rejected;
  - 256 code points accepted and 257 rejected, with emoji counting once (E14/E54);
  - body 65536 accepted and 65537 rejected;
  - body whitespace kept;
  - `''` and `null` become `null`;
  - `state` default and bad values;
  - listing defaults and bounds.
