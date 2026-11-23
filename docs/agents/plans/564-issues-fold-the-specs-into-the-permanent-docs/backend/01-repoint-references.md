# Repoint the spec references

Rewrite every `docs/agents/specs/issues...` path in backend comments, JSDoc and config to its permanent path, using the mapping table in [plan.md](../plan.md#shared-contracts). Keep each `#anchor` as it is. A comment that names a spec file by bare name (for example "`edge-cases.md` of the spec") is reworded to the permanent page.

List the files with `git grep -ln "specs/issues" -- backend`. There are 71 today: the migrations, the entities, the services, controllers and helpers under `backend/src/issues/` and `backend/src/integrations/`, `backend/src/repositories/types/repositories-api.types.ts`, the static and DB specs, and `backend/eslint.config.mjs` (line 197). After this step, `git grep -n "specs/issues" -- backend` prints only `edge-cases.coverage.spec.ts`, which step 02 handles.

Migrations are already applied, so change only their comments, never their code.

## Files to Change

- Every file listed by `git grep -ln "specs/issues" -- backend`, except `backend/src/issues/tests/edge-cases.coverage.spec.ts`: comment paths only.
- `backend/eslint.config.mjs`: the comment on line 197.
