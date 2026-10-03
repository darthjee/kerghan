# Multi-key decryption and re-encryption in the encryption service
Change `IntegrationsEncryptionService` as follows:
- `encrypt` always uses `current`, and `keyId` returns `current.keyId`.
- `decrypt` looks up `byId.get(row.keyId)`. A missing id answers `null` before any crypto. Otherwise it decrypts with that key. Never throw, never log.
- `isDecryptableKeyId(keyId)` returns `byId.has(keyId)`. `integration-response.ts`, which derives `undecryptable` from it, then accepts previous keys automatically. Check its doc comment.
- Add `isCurrentKeyId(keyId)` and `isPreviousKeyId(keyId)`, used by lazy re-encryption and the status command.
- Add `previousKeyIds` and `currentKeyId` accessors so the rotation service can query by id.
- Add `reencrypt(row: EncryptedSecret & SecretBinding): EncryptedSecret | null`. It decrypts with the stored key and re-encrypts the same plaintext under `current`, with a fresh IV and the same AAD. It answers `null` when undecryptable. The plaintext never leaves the service as a string: do the raw decrypt into a buffer and re-encrypt that buffer, rather than round-tripping through `Secret`.

Tests in `integrations-encryption.service.spec.ts` should cover:
- decryption with the current key
- decryption with a previous key
- an unknown key id (no crypto attempted)
- a tampered ciphertext under a previous key
- `reencrypt`: produces the current key id and a new IV, and the result decrypts to the same payload
- `reencrypt` on an undecryptable row answers `null`

## Files to Change
- `backend/src/integrations/integrations-encryption.service.ts` — key selection by id, the new predicates and `reencrypt`.
- `backend/src/integrations/integration-response.ts` — doc comment only, unless its logic hard-codes the single key.
- `backend/src/integrations/tests/integrations-encryption.service.spec.ts` — the new cases.
