# Backend Plan: Refactor: dedupe repoMock test helper across password-reset.service.spec.ts and token.service.spec.ts

Main plan: [plan.md](plan.md)

## Overview
`password-reset.service.spec.ts` and `token.service.spec.ts` each declare a byte-identical `RepoMock<T extends object>` type and `repoMock<T>()` factory; `auth.service.spec.ts` declares the same helper plus an extra `findOne: jest.fn()` stub. This plan moves the (superset) helper into one shared test-support file and switches those three specs to import it. Behavior of the specs must not change.

## Context
- The shared helper is the superset of the three local copies: `findOne`, `findOneBy`, `create`, `save` and `update`, typed `& Partial<T>`.
  - `findOne: jest.fn()` returns `undefined` by default — same as `auth.service.spec.ts` today; the other two specs never call it, so adding it is harmless.
  - `create: jest.fn((attrs) => attrs)`, `save: jest.fn(async (entity) => ({ id: 1, ...entity }))`, `findOneBy: jest.fn()`, `update: jest.fn()` — copied unchanged.
- Precedent: `authorization-request.service.test-support.ts` already centralizes its own `repoMock<T>()` (different shape/defaults). That file is left untouched and must **not** be re-exported or merged into the new one — the new file is a separate, independent helper.
- Test-support file naming convention: `*.test-support.ts` under `backend/src/auth/tests/`; the jest `testRegex` (`.*\.(spec|e2e-spec)\.ts$`) means it is not picked up as a spec.
- Out of scope (different `save` default or different shape): `account.service.spec.ts`, `user-update.service.spec.ts`, the `repoMock` in `authorization-request.service.test-support.ts`, and the local variants in `account-edit-abuse-guard`, `authorization-request-abuse-guard` and `admin.service` specs.

## Implementation Steps

### Step 1 — Create the shared helper
Add `backend/src/auth/tests/repo-mock.test-support.ts` exporting:

```ts
export type RepoMock<T extends object> = {
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
} & Partial<T>;

export function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(async (entity) => ({ id: 1, ...entity })),
    update: jest.fn(),
  } as RepoMock<T>;
}
```

Match the surrounding test-support files' style, including the JSDoc block on the exported function (see `authorization-request.service.test-support.ts`'s `repoMock` for the `@returns` convention the lint config expects).

### Step 2 — Adopt the helper in the three specs
In each of `password-reset.service.spec.ts`, `token.service.spec.ts` and `auth.service.spec.ts`:
- Delete the local `type RepoMock<T extends object> = {...}` and `function repoMock<T extends object>()` declarations.
- Add `import { repoMock, RepoMock } from './repo-mock.test-support.js';` (keep import ordering consistent with the file's existing `../` then `./` imports, and use the `.js` extension like the neighbouring imports).
- Leave every call site (`repoMock<User>()`, etc.) and every test body unchanged.

## Files to Change
- `backend/src/auth/tests/repo-mock.test-support.ts` — new: shared generic `RepoMock<T>` type and `repoMock<T>()` factory.
- `backend/src/auth/tests/password-reset.service.spec.ts` — remove local copy, import shared helper.
- `backend/src/auth/tests/token.service.spec.ts` — remove local copy, import shared helper.
- `backend/src/auth/tests/auth.service.spec.ts` — remove local copy, import shared helper.

## CI Checks
- `backend/`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend/`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Run tooling only through `docker-compose` (project boundary) — never `yarn`/`npm` directly on the host.
- Pure test refactor: no production code, docs or API surface changes; no `data-access`/`security`/`cache` review needed.
- Sanity check after the change: `grep -rn "function repoMock" backend/src/auth/tests` should now list only the out-of-scope files (`account.service.spec.ts`, `user-update.service.spec.ts`, the abuse-guard specs, `admin.service.spec.ts` as `userRepoMock`, and `authorization-request.service.test-support.ts`).
