# Integrations key set
Turn `IntegrationsKey` into a key set: `{ current: KeyEntry; previous: KeyEntry[]; byId: Map<string, Buffer> }`, where `KeyEntry = { key: Buffer; keyId: string }`. `buildIntegrationsKey` (rename it to `buildIntegrationsKeys` if that reads better) reads both `KERGHAN_INTEGRATIONS_KEY` and `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`.

The current key keeps its validation unchanged. For the previous keys:
1. Split on commas, then trim each entry.
2. Drop blank entries, duplicates and entries equal to the current key. Keep the order of first occurrence.
3. Validate every remaining entry with the same rules as the current key, by reusing `decodeStrictBase64`, the length check and `assertNotReused`.
4. Fail boot when two keys have the same `integrationsKeyIdFor` result.

Errors name `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` and the 1-based entry position, and never contain a value. Keep the `INTEGRATIONS_KEY` DI token and update `integrations.module.ts`'s doc comment.

Update the tests in `integrations-key.spec.ts`. They should cover:
- empty or missing previous keys
- trimming, blank entries, duplicates and entries equal to the current key
- each validation failure, naming the position
- the placeholder in production
- an entry equal to the secret key
- a key-id collision
- order preservation

## Files to Change
- `backend/src/integrations/integrations-key.ts` — build the key set and validate the previous keys.
- `backend/src/integrations/integrations.module.ts` — factory name and doc comment.
- `backend/src/integrations/tests/integrations-key.spec.ts` — the new cases.
- `backend/src/integrations/tests/support/build-integrations-test-app.ts`, `backend/src/integrations/tests/support/integrations-harness.ts` — build the new key-set shape.
