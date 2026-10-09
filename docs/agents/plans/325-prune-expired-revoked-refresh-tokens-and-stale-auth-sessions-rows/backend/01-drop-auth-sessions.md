# Drop auth_sessions
Remove the write-only `auth_sessions` bookkeeping:
- Remove `TokenService#touchSession`, its call in `issueTokens`, the `Session` repository constructor parameter and its JSDoc.
- Remove the `Session` entity and its registration in `AuthModule`.
- Add a migration that drops the table. Its `down` recreates the table exactly as `20260824120003-auth-create-sessions` does (columns plus the `idx_auth_sessions_user_id` index), reusing the `idColumn()`/`createdAtColumn()` helpers.
- Remove every `Session` override and mock from the test support and specs.

## Files to Change
- `backend/src/auth/token.service.ts` — drop `sessionRepository`, `#touchSession` and its call; update the class/method JSDoc that mentions the `auth_sessions` row.
- `backend/src/auth/entities/session.entity.ts` — delete.
- `backend/src/auth/auth.module.ts` — remove `Session` from `TypeOrmModule.forFeature`.
- `backend/src/database/migrations/20261009120019-auth-drop-sessions.ts` — new: `up` drops `auth_sessions`; `down` recreates it.
- `backend/src/auth/tests/token.service.spec.ts` — remove the `sessionRepository` mock, the constructor argument and the `save` expectation.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — remove `sessionRepo` (type field, creation, provider override, comment mention).
- `backend/src/integrations/tests/support/build-integrations-test-app.ts` — remove the `Session` import and its provider override.
