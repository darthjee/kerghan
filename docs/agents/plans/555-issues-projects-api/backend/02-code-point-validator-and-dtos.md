# Code-point validator and project DTOs

- **Validators in `core/`:**
  - Add a shared `@MaxCodePoints(n)` / `@MinCodePoints(n)` pair in `core/code-points.validator.ts`. It counts `[...value].length`, so a 4-byte character counts once (E14), and #556 reuses it for titles and bodies.
  - Add a shared `trimString` transform beside it (today it is private in `repositories/dto/list-repositories.dto.ts`; leave that one or point it at the shared one).
- **DTOs in `issues/dto/`.** Types are strict (no coercion: `page: "1"` is `400`), and unknown properties are stripped by the global pipe.
  - **`ListProjectsDto`:**
    - `page`: integer ≥ 1, default 1.
    - `perPage`: 1 to 100, default 50.
    - `search`: trimmed string, at most 100 code points, default `''`.
    - `null` is rejected.
  - **`CreateProjectDto`:**
    - `name`: required string, trimmed, 1 to 100 code points; blank and `null` are rejected.
    - `description`: string or `null`, trimmed, at most 2000 code points.
    - `repository`: optional, `null` allowed. A nested `RepoRefDto` (`@ValidateNested()`, `@Type(() => RepoRefDto)`, `@IsObject()`), reusing `repositories/dto/repo-ref.dto.ts` through the Repositories public surface.
  - **`ProjectFromRepositoryDto`:** `repository` is required and non-null. `name` is optional (`null` rejected), and `description` follows the create rules.
  - **`EditProjectDto`:** `name` is optional (`null` rejected); `description` is optional (`null` or blank clears it).
  - **`ProjectRepositoryDto`:** `repository` is required, and `null` means detach. Use `@ValidateIf(value !== null)` and `@IsDefined()`, so an absent key is `400`.
- **Normalization helpers:** a blank or `null` description becomes `null`. `toCreateInput` and the other mappers give the service plain input types (`issues/types/projects-api.types.ts`).
- **Path id:** `ParseUUIDPipe` on `:projectId` answers `400 VALIDATION_FAILED`. Check that the filter maps its message to `VALIDATION_FAILED` as Sessions does, and copy that usage.

If `RepoRefDto` cannot be imported under the module-boundary rules (ESLint override and `module-boundaries.spec.ts`), export it from a Repositories public file instead of copying it, so the ref rules stay in one place.

## Files to Change
- `backend/src/core/code-points.validator.ts` — the validators and `trimString` (new).
- `backend/src/core/tests/code-points.validator.spec.ts` — an emoji counts once; boundaries 100/101 and 2000/2001 (new).
- `backend/src/issues/dto/list-projects.dto.ts`, `create-project.dto.ts`, `project-from-repository.dto.ts`, `edit-project.dto.ts`, `project-repository.dto.ts` — the DTOs (new).
- `backend/src/issues/types/projects-api.types.ts` — the service input and output types (new).
- `backend/src/issues/tests/project-dtos.spec.ts` — strict types, trimming, `null` handling, required and optional fields, nested ref errors (new).
- `backend/src/repositories/...` (public surface) — export `RepoRefDto` and `toRepoRef` if needed.
