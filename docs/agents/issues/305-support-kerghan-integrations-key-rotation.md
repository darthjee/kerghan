# Issue: Support KERGHAN_INTEGRATIONS_KEY rotation

## Description
GitHub integrations (#295) store each user's GitHub credentials encrypted at rest with AES-256-GCM under `KERGHAN_INTEGRATIONS_KEY` (`backend/src/integrations/integrations-key.ts`, `integrations-encryption.service.ts`). This key is independent of `KERGHAN_SECRET_KEY`. Today only a **single** key is supported. However, every row already stores `secret_key_id` (the first 8 hex characters of SHA-256 over the raw key, indexed), so rotation can be added without a data migration.

Support rotating `KERGHAN_INTEGRATIONS_KEY` without downtime and without losing stored credentials. Follow the approach already used for `KERGHAN_SECRET_KEY` (#285, `backend/src/core/secret-keys.ts`).

## Problem
- If the integrations key leaks or has to be replaced, the only option today is to swap it. Every stored credential then becomes `undecryptable`, and every user has to re-enter their credentials.
- Decryption happens only in the connection test (`integration-connection-test.service.ts`), and `IntegrationsEncryptionService.isDecryptableKeyId` accepts only the current key id.

## Expected Behavior
- A new `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` env var (comma-separated) holds retired keys. They are used for **decryption only**; new ciphertexts always use the current key.
- Parsing follows the `secret-keys.ts` rules: values are trimmed, and blank entries, duplicates and entries equal to the current key are dropped.
- The stored `secret_key_id` selects the key used for decryption. A key id that matches no configured key gives `undecryptable` without any decryption attempt, as today. This follows the status lifecycle in `docs/agents/modules/integrations.md`.
- Secrets encrypted with a previous key are re-encrypted with the current key, both lazily and through an explicit command (see Solution).
- An operator can check that no rows still use a retired key before dropping it.
- Previous keys get the same strict boot validation as the current key.
- The rotation procedure is documented in `docs/agents/environment-variables.md`, and `docs/agents/modules/integrations.md` (the "Single key" bullet under Key) is updated.

## Solution
- **Key set.** Replace the single `IntegrationsKey` with a key set: the current key plus the previous keys, each with its key id. This mirrors `buildSecretKeys`.
  - Every previous key is validated like the current one: strict base64 of exactly 32 bytes, different from `KERGHAN_SECRET_KEY`, and never the public dev placeholder when `NODE_ENV=production`.
  - Boot fails when two configured keys produce the same key id.
  - Boot errors name the variable and the entry's position in the list, never its value.
- **Decryption.** `IntegrationsEncryptionService` picks the key by the stored `secret_key_id`. `isDecryptableKeyId` accepts any configured key id. Encryption always uses the current key.
- **Lazy re-encryption.** When a row is decrypted successfully under a previous key (today: the connection test), it is re-encrypted under the current key with a fresh IV and the same AAD, then persisted. This happens whatever the GitHub test result is.
- **Explicit re-encrypt command.** A Nest standalone application-context script (a `package.json` script, run through docker-compose, with a `Makefile` target) re-encrypts every row whose `secret_key_id` belongs to a previous key.
  - It is idempotent and safe to re-run.
  - Each update is conditioned on the `secret_key_id` being unchanged, so it never overwrites a concurrent replacement.
  - Rows that fail to decrypt are skipped and counted, never changed.
  - It never logs secrets or keys, only counts, key ids and integration uuids.
- **Verification command.** A read-only command reports the row count per `secret_key_id`, labelled `current`, `previous` or `unknown`. A retired key is safe to drop once its count is 0.
- **Docs.**
  - `docs/agents/environment-variables.md`: the new variable and a step-by-step rotation procedure:
    1. Move the old key to `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` and set a new current key.
    2. Deploy.
    3. Run the re-encrypt command.
    4. Run the verification command and confirm the count is 0.
    5. Drop the old key.
  - `docs/agents/modules/integrations.md`: update the Key / Key id sections.
  - Samples (`.env.dev.sample`, docker-compose) list the new variable, left empty.

## Benefits
- Zero-downtime key rotation, with no loss of stored credentials.
- A safe, verifiable path to fully retire a compromised or old key.

## Out of Scope
- Rotating `KERGHAN_SECRET_KEY`, which was already done in #285.
- Per-type credential refresh (e.g. OAuth refresh tokens), which is not key rotation.

## Verification
- Jest specs cover:
  - decryption with the current key
  - decryption with a previous key
  - re-encryption
  - an unknown key id
  - parsing and boot validation of the env var (including key-id collisions)
  - lazy re-encryption on the connection test
  - the re-encrypt and verification commands
- Lint and coverage pass inside docker-compose.
