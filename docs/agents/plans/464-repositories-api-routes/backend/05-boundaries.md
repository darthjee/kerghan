# ESLint boundary and static boundary spec

This step adds the module boundary from `security.md#module-boundaries` and `testing.md#module-boundaries`.

## ESLint override

In `backend/eslint.config.mjs`, add a `files: ['src/repositories/**/*.ts']` block. Exclude the tests (`ignores: ['src/repositories/tests/**']`) if the test support legitimately imports Integrations test fakes. Keep the fakes allowed for tests only.

**`no-restricted-imports` patterns:**

- **Refused:**
  - `**/integrations/entities/**`, `**/auth/entities/**`;
  - `**/integrations/integrations-encryption.service*`;
  - `**/integrations/github-client.service*`, `**/integrations/github-repo-client.service*`, `**/integrations/github-app-client.service*`;
  - any other `**/integrations/**` or `**/auth/**` path that is not on the allowlist.
- **Allowed:**
  - `integrations/integrations-github.public`, plus its typed results (`github-repo-results`, `add-candidate-walk`);
  - `auth/account-handle.service`;
  - `auth/events/user-deleted.event`;
  - the `integration.deleted` event type file.

Express this as a deny-by-default pattern with explicit exceptions (`group` with negated patterns), so a new Integrations file is refused until it is allowlisted.

**`no-restricted-globals`:** `fetch`.

`auth/entities/user.entity` may be imported today by #463's code. Check this with `yarn lint`. If a production file does import it, reroute that use through `AccountHandleService` (the spec forbids it) rather than allowlisting it.

## Static spec (`repositories/tests/module-boundaries.spec.ts`)

This spec does not boot the app, in the style of `core/tests/cache-policy.coverage.spec.ts` and #463's `no-sql-now.spec.ts`. It:

- reads every `src/repositories/**/*.ts` file outside `tests/`;
- asserts that there is no `auth_users`, no `integrations` table name in SQL strings or `@Entity(...)` and no `secret_iv`. Reuse or fold in `no-sql-now.spec.ts`'s scanner for `NOW(` / `CURRENT_TIMESTAMP`, and don't duplicate it;
- asserts that no entity in `REPOSITORIES_ENTITIES` maps `auth_users` or `integrations` (use TypeORM metadata via `getMetadataArgsStorage()`);
- checks the exported `IntegrationsGithubService` result types (`IntegrationRef`, `GithubRepo`, `RepoPageResult`, `RepoResult` variants) against a fixed allowlist of keys. Use builders from `integrations/tests/support/github-builders.ts` to produce one of each variant and compare `Object.keys`.

A further spec, `eslint-boundary.spec.ts`, asserts that the ESLint override refuses each forbidden import and `fetch`. It runs ESLint's `Linter` / `ESLint` API on in-memory snippets with the real config.

## Files to Change

- `backend/eslint.config.mjs`: the override.
- `backend/src/repositories/tests/module-boundaries.spec.ts`: new.
- `backend/src/repositories/tests/eslint-boundary.spec.ts`: new.
- Any `backend/src/repositories/*.ts` that the new rule flags: reroute it through the allowed entry points.
