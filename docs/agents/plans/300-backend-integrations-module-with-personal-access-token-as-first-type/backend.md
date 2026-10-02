# Backend Plan: Backend: integrations module with Personal Access Token as first type

Main plan: [plan.md](plan.md)

## Shared contracts

- **Env vars:** see [plan.md](plan.md#shared-contracts).
  - Read `KERGHAN_INTEGRATIONS_KEY` once, in a module provider factory. The four numeric vars
    use `getNumberConfig` (`core/numeric-config.ts`) with the defaults 20, 5, 900000 and 30000.
  - Export the placeholder as `INTEGRATIONS_KEY_DEV_PLACEHOLDER`
    (`a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=`) from
    `backend/src/integrations/integrations-key.ts`. Infra uses the same literal.
- **API:** exactly the routes, payloads, response shape and error codes in
  `docs/agents/specs/integrations/api.md`. #301 (frontend) consumes them, so keep field names
  byte-exact.

## Steps

- [01 — Core: error codes, 422 category, Retry-After](backend/01-core-error-codes-and-retry-after.md)
- [02 — Secret wrapper, key config and encryption service](backend/02-secret-key-and-encryption.md)
- [03 — Entities and migrations](backend/03-entities-and-migrations.md)
- [04 — GitHub client service](backend/04-github-client.md)
- [05 — Type contract, registry and PAT strategy](backend/05-type-contract-and-pat-strategy.md)
- [06 — Credential cool-off and test cooldown](backend/06-rate-limiting.md)
- [07 — Integrations service, controller and module wiring](backend/07-service-controller-module.md)
- [08 — E2E specs and final checks](backend/08-e2e-specs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`).
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`).

## Notes

- **Specs are binding.** Each step's specs must cover the matching **Required tests** sections
  of `model.md`, `api.md`, `security.md`, `type-contract.md` and `types/pat.md`.
- **Atomic SQL vs. in-memory repos.** The e2e support (`auth/tests/support/in-memory-repo.ts`)
  can't run raw `UPDATE … WHERE` or `INSERT … ON DUPLICATE KEY UPDATE`.
  - Put every atomic statement (lockout upsert/increment, test cooldown claim) behind one small
    method of a dedicated service.
  - Unit-test the SQL/QueryBuilder shape against a mocked repository or `DataSource`.
  - Give the e2e specs an in-memory double of that service with the same semantics.
- **No cross-module joins.** The physical FK to `auth_users` exists only in the migration. The
  entity has a plain `userId` column, no TypeORM relation.
- **The owner comes from `@CurrentUser()` / `req.user.sub`**, never from a body or query.
- **Never log or throw secrets.** Use the safe-field list in `security.md`. Don't add
  integrations fields to any admin endpoint.
- **Out of scope:** module docs (`docs/agents/modules/integrations.md`), `product.md` and
  `flow.md` (#304), key rotation (#305), frontend (#301), OAuth App and GitHub App (#302/#303).
- **Manual smoke check:** run `types/pat.md`'s "Manual smoke check (#300)" in the running stack
  with throwaway tokens, and record the outcome in the PR description.
