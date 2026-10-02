# `integrations_oauth_states` table and state service

Persist a started flow server-side, exactly as in the spec's *State* section.

**Migration `20261002120013-integrations-create-oauth-states.ts`:**

- Follows the style of `20261002120012-integrations-create-credential-lockouts.ts` and its
  `helpers.ts`.
- Columns: `id`, `uuid` `char(36)`, `user_id` `int`, `secret_hash` `char(64)`,
  `purpose` `varchar(16)`, `label` `varchar(100)` nullable, `integration_uuid` `char(36)`
  nullable, `code_verifier` `varchar(128)`, `expires_at` `datetime`, `created_at`.
- Indexes: unique `uuid`, non-unique `user_id`, non-unique `expires_at`.
- A working `down` that drops the table.
- `user_id` is a logical FK to `auth_users.id`, with no physical FK, like the lockouts table.

**Entity `IntegrationOauthState`:** registered in `TypeOrmModule.forFeature`, and in the
`integrations-migrations.spec.ts` checks.

**`OauthStateService`:**

- **`issue(userId, purpose, { label } | { integrationUuid })`**, which returns
  `{ state, codeChallenge }`:
  1. Delete every expired row.
  2. Keep at most **4** of the user's pending rows (deleting the oldest), so that with the new
     one there are at most 5.
  3. Generate the `uuid`, a 32-byte secret (`crypto.randomBytes`, base64url without padding,
     43 characters) and a 32-byte `code_verifier`.
  4. Store `sha256(secret)` as hex, and `expires_at` = now + 10 minutes.
  5. `state` = `<uuid>.<secret>`; `codeChallenge` = base64url SHA-256 of the verifier.
- **`consume(userId, state)`**, which returns `{ purpose, label, integrationUuid, codeVerifier }`
  or throws `400 INTEGRATION_REDIRECT_STATE_INVALID`:
  1. Validate against `^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$`.
  2. Look the row up with `uuid = ? AND user_id = ?`.
  3. Delete it atomically (`DELETE … WHERE id = ?`), proceeding only if exactly one row was
     deleted.
  4. Then compare `sha256(secret)` with `secret_hash` using `crypto.timingSafeEqual`, and reject
     an expired row.

  Every failure gives the same error, and a mismatched or expired row is deleted too. Add an
  `invalidRedirectState()` helper to `integration-http-errors.ts` (the code already exists in
  `ErrorCodes`).

The `state`, the secret and the verifier are never logged and never put in an error message.

Specs (`tests/oauth-state.service.spec.ts`, plus an in-memory or test repository like the
existing support files):

- issue/consume round trip;
- a replay → 400;
- expired, unknown, another user's and wrong-secret states → the same 400;
- two parallel consumes → exactly one succeeds;
- the stored row never holds the raw secret;
- expired rows are purged and at most 5 pending rows are kept per user;
- the challenge matches the verifier.

## Files to Change

- `backend/src/database/migrations/20261002120013-integrations-create-oauth-states.ts` — new migration.
- `backend/src/integrations/entities/integration-oauth-state.entity.ts` — new entity.
- `backend/src/integrations/types/oauth-app/oauth-state.service.ts` — new service.
- `backend/src/integrations/integration-http-errors.ts` — `invalidRedirectState()`.
- `backend/src/integrations/integrations.module.ts` — register the entity and the service.
- `backend/src/database/tests/integrations-migrations.spec.ts` — cover the new migration.
- `backend/src/integrations/tests/oauth-state.service.spec.ts` — new.
