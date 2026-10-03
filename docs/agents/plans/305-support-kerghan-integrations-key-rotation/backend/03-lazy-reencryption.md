# Lazy re-encryption on connection test
In `IntegrationConnectionTestService.test`, after a successful `decryptRow` of a row whose `secretKeyId` is a previous key:
1. Call `encryption.reencrypt(...)`.
2. Persist `secretKeyId`, `secretIv`, `secretAuthTag` and `secretCiphertext` through the store, in the same update that records the test outcome.
3. The rewrite happens whatever the GitHub result is: active, invalid, expired or transient. For the transient path, add the secret columns to the `lastTestedAt`/`transient_error` update before throwing.

Keep this at the test-connection path only. Delete removes the row anyway, and the OAuth replace flow already writes a freshly encrypted secret.

The write must not clobber a concurrent credential replacement. Add a store method, e.g. `IntegrationStoreService.rewriteSecret(row, encrypted, expectedKeyId)`. Its `UPDATE` is scoped by `id`, `user_id` **and** `secret_key_id = expectedKeyId`, and 0 affected rows is a silent no-op. Do this rewrite as its own conditional update, separate from the outcome update. That is simpler than merging the two, and the outcome update stays unconditional as today. Log only the uuid and the old and new key ids.

Tests in `integrations.service.test-connection.spec.ts` (and the e2e test-delete spec if useful) should cover:
- a previous-key row tested with each outcome ends on the current key id and decrypts to the same payload
- a current-key row is not rewritten
- an unknown-key row stays `undecryptable` and is not rewritten
- a concurrent change of `secret_key_id` makes the rewrite a no-op

## Files to Change
- `backend/src/integrations/integration-connection-test.service.ts` — call the rewrite after a successful decrypt under a previous key.
- `backend/src/integrations/integration-store.service.ts` — `rewriteSecret` with the key-id-conditioned update.
- `backend/src/integrations/tests/integrations.service.test-connection.spec.ts`, `backend/src/integrations/tests/integration-store.service.spec.ts` — specs.
