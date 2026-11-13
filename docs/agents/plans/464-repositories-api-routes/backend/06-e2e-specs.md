# E2E with fakes: routes, access matrix, cache coverage

## Harness (`repositories/tests/support/build-repositories-test-app.ts`)

Build it on the pattern of `build-integrations-test-app.ts`: the real Nest app with the global guards, the `ValidationPipe`, the filter and the cache interceptor. It overrides:

- `RepositoriesService` with a typed in-memory `FakeRepositoriesService` (new, in `tests/support/`). The fake stores rows per `userId` and implements `list`, `syncState`, `triggerIfStale`, `refresh`, `reconcileForRequest`, `findByRef` and `markAdded` over that store. It records the calls, so tests can assert that a sync was triggered or not.
- `IntegrationsGithubService` with `FakeIntegrationsGithubService`;
- `Clock` with `FakeClock`;
- `SyncLauncher` with `CapturingLauncher`.

Seed the two-user baseline: the owner, plus an **intruder** with a row of the same `githubId` and an integration of its own. Seed an admin user too.

The real `RepositoryAddService` and the real rate limiter run on top.

## Specs

- **`repositories.controller.access.e2e-spec.ts`, the route access matrix (`security.md#required-tests`):**
  - **Rows:** the four routes, `POST /auth/account/mine.json` and the handle path of `PATCH /auth/account.json`.
  - **For every row:**
    - `401` without a session;
    - `403` from a foreign `Origin`;
    - `X-Skip-Cache` and `Cache-Control: no-store` on a success and on a handler `400`/`404`/`429`.
  - **The Add row:** the intruder's repo and a missing repo answer identical bodies, timestamp ignored.
  - **Admins:** an admin session gets the admin's own (empty) data and never another user's. `/admin/users/*` responses carry no repository-derived field and no `githubHandle`.
  - **`GET` refused:** no repositories route answers `GET`.
  - **Completeness:** read every route registered on `RepositoriesController` from Nest metadata (`PATH_METADATA` / `METHOD_METADATA`), and fail if any is missing from the table. If the auth rows' e2e harness cannot be shared, the auth rows may stay in a sibling spec, as long as the matrix table includes them.
- **`repositories.controller.listing.e2e-spec.ts`:**
  - the defaults, bounds and `400`s;
  - a past-the-end page answers `200 []`;
  - unknown body properties are stripped;
  - the exact row shape;
  - `sync.state: "syncing"` when the fake's trigger starts a sync;
  - no forbidden keys anywhere in the body (`id`, `userId`, `user_id`, `integrationId`, `secretHint`, `githubLogin`, `statusReason`).
- **`repositories.controller.sync.e2e-spec.ts`:**
  - **Sync state:** the exact shape, and it never triggers a sync.
  - **Refresh:**
    - `202` on `started` and `running`;
    - `429 REPOSITORY_REFRESH_COOLDOWN` with `Retry-After` and `error.retryAfterSeconds`, which agree;
    - a body sent to these routes is ignored.
- **`repositories.controller.add.e2e-spec.ts`:**
  - the DTO `400` matrix;
  - `404` for a missing ref, an intruder-only ref or a `githubId` not in the caller's rows, with no GitHub call (fake call log);
  - already added → `200`, with no GitHub call and `addedAt` unchanged;
  - all candidates deny → `404` with the same body;
  - `409` with no GitHub call;
  - `503` on a rate limit or a low budget, with `Retry-After` when known;
  - `502` on a timeout, a `5xx` or a redirect;
  - the 31st Add → `429 REPOSITORY_ADD_RATE_LIMITED`, the window following `FakeClock`, env overrides applied (`ConfigService` override);
  - a case-variant `fullName` resolves, and an owner with `--`, a leading or trailing hyphen, or 40 characters → `400`;
  - the re-check called with the stored `githubId`.
- **`core/tests/cache-policy.coverage.spec.ts`:** add `RepositoriesController` to `KNOWN_CONTROLLERS`, and assert `CacheClass.UserScoped` on each of its routes. Assert `CacheClass.Never` on `POST /auth/account/mine.json`, unless #460 already asserts it there.

## Files to Change

- `backend/src/repositories/tests/support/build-repositories-test-app.ts`, `fake-repositories.service.ts`: new.
- `backend/src/repositories/tests/repositories.controller.access.e2e-spec.ts`, `repositories.controller.listing.e2e-spec.ts`, `repositories.controller.sync.e2e-spec.ts`, `repositories.controller.add.e2e-spec.ts`: new.
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: the Repositories controller and its class.
