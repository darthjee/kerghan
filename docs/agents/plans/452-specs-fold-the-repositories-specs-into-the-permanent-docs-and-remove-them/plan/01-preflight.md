# Preflight: blocking check, open markers, contract spot-check

Before editing anything:

1. **Blocking check:** confirm that every implementation sub-issue of #444 (listed in `docs/agents/specs/repos/README.md` and on #444) is merged or closed. Note any that were closed without being built: their part is left out of the docs and recorded in `product.md` "What's still open" (step 04).
2. **Open markers:** grep `docs/agents/specs/repos/` for `Open — settled by` and check the README's "Open markers" table reads "None". If anything remains, stop and report it; that is not #452's to settle.
3. **Contract spot-check** against the merged code, noting every mismatch:
   - routes, methods, DTO fields, and status codes (Repositories controller(s), `PATCH /auth/account.json`, `POST /auth/account/mine.json`) vs. `api.md` and the Auth items;
   - `backend/src/core/error-codes.ts` (`REPOSITORY_SOURCE_UNUSABLE`, `DEFAULT_USER_MANAGED`) and `error.retryAfterSeconds`;
   - `KERGHAN_REPOSITORIES_*` names and defaults vs. the config/validation code;
   - migrations (the five tables, `auth_users.github_handle`, indexes, types) vs. `model.md`;
   - events (`integration.deleted`, `user.deleted`) and exports (`IntegrationsGithubService`, `AccountHandleService`);
   - the ESLint override on `backend/src/repositories/**`, `*.db-spec.ts` / `yarn test:db`, and the MySQL CI job in `.circleci/config.yml`;
   - `@CachePolicy` on every Repositories route and `POST /auth/account/mine.json`.
4. **Conditional items:** check whether `Clock` / `SyncLauncher` are used outside `backend/src/repositories/`, and whether the ESLint override affects imports elsewhere. Record each decision (promote, or moot with a reason).
5. For each mismatch where the built behaviour looks wrong, open a new issue linked to #444 that cites the spec rule. Keep a running list for the PR description.

## Files to Change

- None (read-only). Records the mismatch list and the conditional decisions for the later steps.
