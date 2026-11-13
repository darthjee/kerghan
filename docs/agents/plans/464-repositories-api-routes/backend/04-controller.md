# DTOs, controller, response shaping and wiring

## DTOs (`repositories/dto/`)

- **`ListRepositoriesDto`:**
  - `page`: integer ≥ 1, default 1;
  - `perPage`: integer from 1 to 100, default 50;
  - `filter`: one of `all|added|not_added|unavailable`, default `all`, so `unknown` answers `400`;
  - `search`: a string of at most 100 characters, trimmed, default `''`.

  Use the defaults and bounds from `api.md#request`. Check them against the spec's table and adjust if it differs.
- **`RepoRefDto`:**
  - `githubId?`: an integer, positive, at most `Number.MAX_SAFE_INTEGER`. It is typed as a number with `@IsInt`, `@Min(1)` and `@Max(Number.MAX_SAFE_INTEGER)`, so `1e300` and fractions fail.
  - `fullName?`: matches `^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$`.
  - A class-level validator for exactly one of `githubId` / `fullName`, so both or neither answers `400`.
  - Map the DTO to a `RepoRef` in the controller with a small pure function.

## Controller (`repositories/repositories.controller.ts`)

The controller has `@Controller()` and `@CachePolicy(CacheClass.UserScoped)`, and every route is `@Post`. It has no `@Public` or `@AdminOnly`, and it gets `userId` from `@CurrentUser()`.

- **`POST repositories/mine.json` (200):**
  1. Call `triggerIfStale(userId)`, which also reconciles. On `no_user`, answer `401`.
  2. Call `list(userId, input)` and `syncState(userId)`.
  3. Answer `{ repositories, pagination: { page, perPage, total, totalPages }, sync }`. Triggering first means a sync it started reads `syncing`.
- **`POST repositories/sync/state.json` (200):** call `reconcileForRequest(userId)` (`no_user` → `401`), then return the shaped `syncState(userId)`. It never triggers a sync.
- **`POST repositories/sync.json` (`@HttpCode(202)`):** call `refresh(userId)`.
  - `started` / `running` → `202` with the shaped `syncState`.
  - `cooldown` → `refreshCooldown(ceil((refreshAvailableAt - now) / 1000))`.
  - `no_user` → `401`.
  - `fresh` cannot occur in refresh mode; treat it like `running`.
- **`POST repositories/add.json` (200):** `addService.add(userId, toRepoRef(dto))`, then shape the row.

If the mapping from service outcome to HTTP grows beyond trivial branches, move it into a small `RepositoriesHttpService` (or into `RepositoryAddService`-style services), so the controller stays thin per CLAUDE.md. The controller must not contain business rules.

## Response shaping (`repositories/repositories-response.ts`)

Pure functions that serialize `ListedRepository`, `SyncStateResult` and the sources into the `api.md` JSON:

- dates become ISO strings, or `null`;
- the keys are exactly those in `api.md#response` and `#sync-state`.

These functions are the only path to the wire, and they use an explicit field copy, never a spread, so no internal field can leak.

## Wiring

`RepositoriesModule` declares `controllers: [RepositoriesController]`. It is already imported by `AppModule`.

## Files to Change

- `backend/src/repositories/dto/list-repositories.dto.ts`, `backend/src/repositories/dto/repo-ref.dto.ts`: new.
- `backend/src/repositories/repositories.controller.ts`: new.
- `backend/src/repositories/repositories-response.ts`: new.
- `backend/src/repositories/repositories.module.ts`: the controller.
- `backend/src/repositories/tests/repositories-response.spec.ts`: the exact shape, ISO dates, and no `id`, `userId` or `integrationId` keys.
- `backend/src/repositories/tests/repo-ref.dto.spec.ts` and `list-repositories.dto.spec.ts`: the validation matrix from `api.md#required-tests`, at unit level with `class-validator`'s `validate`.
