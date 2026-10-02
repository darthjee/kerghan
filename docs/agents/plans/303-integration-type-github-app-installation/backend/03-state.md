# State table and service
New table `integrations_github_app_states` exactly as the spec's *State* section (`uuid`
unique, `user_id`, `secret_hash`, `stage` `redirect|select`, `purpose`, `label`,
`integration_uuid`, `candidate_installation_ids` json, `expires_at`, `created_at`; indexes on
uuid (unique), user_id, expires_at; working `down`). Do **not** reuse or alter
`integrations_oauth_states` (rejected in the spec).

`GithubAppStateService`: `issueRedirect(userId, purpose)`, `issueSelect(userId, from, candidates)`,
`consume(userId, state, stage)`. Same rules as the OAuth state: `<uuid>.<43 b64url>` format
(reuse `OAUTH_STATE_PATTERN`), lookup by `uuid + user_id`, atomic delete-then-check,
`timingSafeEqual` on SHA-256, 10-minute TTL, prune expired + keep ≤5 pending per user on every
issue; wrong secret, expired or wrong stage → row deleted and the same 400. Extract
`sha256Hex`/`secretMatches` from `oauth-state.service.ts` into a shared helper.

## Files to Change
- `backend/src/integrations/entities/integration-github-app-state.entity.ts` — new.
- `backend/src/database/migrations/20261002120014-integrations-create-github-app-states.ts` — new (next timestamp after the oauth-states migration).
- `backend/src/integrations/types/github-app/github-app-state.service.ts` — new.
- `backend/src/integrations/types/oauth-app/oauth-state.service.ts` — use extracted helpers.
- `backend/src/database/tests/integrations-migrations.spec.ts` — cover up/down.
- `backend/src/integrations/tests/github-app-state.service.spec.ts`, `backend/src/integrations/tests/support/in-memory-github-app-states.ts` — new.
