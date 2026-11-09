# Integrations and Auth docs

Commit 2: fold the Integrations and Auth checklist items.

- **`modules/integrations.md`:**
  - replace "The module exports nothing yet" with the `IntegrationsGithubService` export (operations, typed results, the single GitHub client, fixed base URL and redirect handling, error mapping, usable integrations, access-link choice and the Add candidate walk, the unauthenticated budget tracker, the `core/` `502`/`503` helpers);
  - the awaited `integration.deleted` event;
  - the `401 → invalid` rule as built (repo-call `401`, mint `404`/`403`, decrypt failure), drop its "Not built yet" note, and the `secret_iv` compare-and-set;
  - update the "Credential stops working" edge case;
  - link the new `architecture/security.md#credentials-stay-in-the-backend` section;
  - move the owner-assigned "Required tests" from `specs/repos/integrations.md` into its Testing section.
- **`modules/integrations/github-app.md`:** the in-memory installation-token cache (until `expires_at` − 5 min, `metadata: read`); test connection still mints fresh.
- **`modules/auth.md`:**
  - the `github_handle` column (normalisation, validation), the exported `AccountHandleService`, the handle-change reconciliation;
  - the `user.deleted` contract, with a "Not built yet" note on the emitter if no deletion path exists (emit after commit; retry or orphan sweep);
  - the admin routes table stays without the handle.
- **`modules/auth/default-user.md`:** "What is blocked" and "Rule: per field, by presence" gain `github_handle` as editable and unmanaged; replace the "every editable field is managed today" rationale with the one from `model.md#default-user`; boot sync never touches the handle.
- **`backend/routes/auth.md`:** `PATCH /auth/account.json` (`githubHandle`, `currentPassword` only with managed fields, the handle-only path outside the abuse guard, the `{ username, email, githubHandle }` response, the new `assertAnyFieldPresent` message), the new `POST /auth/account/mine.json`, and the default-user `409` table's `account.json` row.

## Files to Change

- `docs/agents/modules/integrations.md`
- `docs/agents/modules/integrations/github-app.md`
- `docs/agents/modules/auth.md`
- `docs/agents/modules/auth/default-user.md`
- `docs/agents/backend/routes/auth.md`
