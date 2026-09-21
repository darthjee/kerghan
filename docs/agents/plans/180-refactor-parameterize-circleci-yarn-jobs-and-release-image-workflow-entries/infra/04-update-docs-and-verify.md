# Update docs and verify equivalence
Verify that the refactor did not change the pipeline, then update the docs.

Verification (all through the `circleci` compose service from step 01):
1. `docker-compose run --rm circleci config validate` passes on the refactored config.
2. Compare `config process` output of the original config (from `origin/main`) and the refactored one: the resulting set of jobs/workflow entries must match — same job names (`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, the eight `release-*` names), same `requires:`, same filters, and same commands per step (aside from the intentional `release-image` argument derivation). Note any intentional difference explicitly in the PR description.

Docs:
- `docs/agents/architecture/infra.md`: update the "CI jobs" table (`backend_tests`/`backend_checks`/`jasmine`/`frontend-checks` are now workflow instances of the shared `yarn_project` job) and the "`release-image` instances" section (parameters are now `image` × `suffix` via a `matrix`, with the name template) so it no longer says "instantiated 8 times"; mention the `setup_project` command shared with `upload_fe_files`.
- `docs/agents/contributing.md`: in the CI Checks table, replace "No local equivalent" for the `.circleci/` row with the validation command `docker-compose run --rm circleci config validate` (keeping the note that the jobs themselves run only in CI/on tagged releases).
- Add a short mention of the `circleci` compose service wherever compose services/dev tooling are listed (check `docs/agents/architecture/infra.md` and `docs/agents/folder-structure.md`).

## Files to Change
- `docs/agents/architecture/infra.md` — reflect `yarn_project`, `setup_project` and the `release-image` matrix.
- `docs/agents/contributing.md` — CI Checks table: add the config validation command.
- `docs/agents/folder-structure.md` — only if it lists compose services/CircleCI config and needs the new service mentioned.
