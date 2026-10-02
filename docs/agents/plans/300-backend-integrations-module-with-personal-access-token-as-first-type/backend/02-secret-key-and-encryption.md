# Secret wrapper, key config and encryption service

Implement `security.md`'s "Encryption at rest", "Key", "Key id" and the `Secret` rule.

- **`Secret`** (`integrations/secret.ts`): an immutable value type holding a string (or a
  JSON-serialisable payload).
  - `toString()`, `toJSON()` and `[util.inspect.custom]` all return `[REDACTED]`.
  - Only an explicit `reveal()` (or similar) unwraps it. Call it only at the GitHub client call
    site and in the encryption service.
- **Key config** (`integrations/integrations-key.ts`):
  - Export `INTEGRATIONS_KEY_DEV_PLACEHOLDER`.
  - Export a pure `buildIntegrationsKey(configService)` that reads `KERGHAN_INTEGRATIONS_KEY`,
    `KERGHAN_SECRET_KEY` and `NODE_ENV`, validates every boot rule in the shared contract, and
    returns `{ key: Buffer, keyId: string }`.
    - Strict base64: round-trip check, so a non-base64 string is rejected rather than leniently
      decoded.
    - `keyId` = first 8 hex chars of SHA-256 over the raw 32 bytes.
  - Errors name `KERGHAN_INTEGRATIONS_KEY` and never contain the value.
  - Provide the result through a DI token (e.g. `INTEGRATIONS_KEY`) whose `useFactory` calls
    this function, so a bad key fails Nest boot. Nothing reads `process.env` directly.
- **`IntegrationsEncryptionService`:**
  - `encrypt(secret, { uuid, type })` uses AES-256-GCM with a fresh `randomBytes(12)` IV, AAD
    = UTF-8 `"<uuid>:<type>"` and a 16-byte tag. It returns
    `{ keyId, iv, authTag, ciphertext }`, with the plaintext as `JSON.stringify` of the payload.
  - `decrypt(row)` returns `Secret | null`. It returns `null` (undecryptable), without throwing
    and without logging secret material, when:
    - the key id doesn't match, checked **before** any crypto;
    - auth-tag verification fails, or the JSON can't be parsed.
  - `isDecryptableKeyId(keyId)` lets list/show report `undecryptable` without decrypting.
  - Use Node `crypto` only, with no new dependency.

Specs (`integrations/tests/`):
- `Secret` redaction: `toString`, `toJSON`, `JSON.stringify`, `util.inspect`, template literal.
- Boot validation: missing, blank, non-base64, 31/33 bytes, equal to `KERGHAN_SECRET_KEY`, and
  the placeholder under production each throw without the value in the message; the placeholder
  outside production passes.
- Key id: matches the reference SHA-256 prefix.
- Encryption:
  - round trip;
  - two encryptions of the same payload differ;
  - tampered ciphertext, IV, tag or AAD (another uuid or type) → `null`;
  - key-id mismatch → `null` without calling the decipher (spy).

## Files to Change
- `backend/src/integrations/secret.ts`: new.
- `backend/src/integrations/integrations-key.ts`: new.
- `backend/src/integrations/integrations-encryption.service.ts`: new.
- `backend/src/integrations/tests/secret.spec.ts`, `integrations-key.spec.ts`, `integrations-encryption.service.spec.ts`: new.
