# Plan: Support KERGHAN_INTEGRATIONS_KEY rotation

Issue: [305-support-kerghan-integrations-key-rotation.md](../../issues/305-support-kerghan-integrations-key-rotation.md)

## Overview
Make `KERGHAN_INTEGRATIONS_KEY` rotatable without downtime. The pieces:
- A new `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` env var holds decrypt-only keys.
- The stored `secret_key_id` picks which key decrypts a row.
- Rows under a previous key are re-encrypted with the current key, in two ways:
  - lazily, when a connection test decrypts them
  - through an explicit command
- A read-only status command reports how many rows each key id still holds, so an operator can tell when a retired key is safe to drop.

The backend builds the key set, the encryption changes and the commands. Infra exposes the commands as `Makefile` targets. The architect updates the docs and the env sample.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)
- [architect](architect.md)

## Shared contracts

### Env var
`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` is optional and defaults to empty. It is a comma-separated list of retired integrations keys, each base64 of exactly 32 bytes.
- Entries are trimmed, and blank entries, duplicates and entries equal to the current key are dropped. These are the `secret-keys.ts` rules.
- Every remaining entry is validated like `KERGHAN_INTEGRATIONS_KEY`: strict base64, exactly 32 bytes, different from `KERGHAN_SECRET_KEY`, and not the public dev placeholder when `NODE_ENV=production`.
- Boot also fails when two configured keys share a key id.
- Errors name the variable and the entry's 1-based position, never the value.

### Backend commands (`backend/package.json` scripts)
Both scripts run the compiled entrypoint, so `dist/` must be built first. In production it already is.

| Script | Runs | Effect |
|---|---|---|
| `integrations:keys:status` | `node dist/integrations/cli/integrations-keys.js status` | Read-only. |
| `integrations:keys:reencrypt` | `node dist/integrations/cli/integrations-keys.js reencrypt` | Re-encrypts every row under a previous key. |

**`status` output.** One line per `secret_key_id` present in `integrations`:

```text
<keyId> <current|previous|unknown> <count>
```

A configured key with 0 rows is still listed, with count `0`. The command exits `0`.

**`reencrypt` output.** One summary line:

```text
reencrypted=<n> skipped_undecryptable=<n> skipped_changed=<n>
```

It exits `0` when `skipped_undecryptable` is 0, and `1` otherwise.

**Neither command** ever prints a key, a ciphertext or a secret. They print only key ids, counts and integration uuids (for skipped rows).

### Makefile targets (infra)
Both run inside docker-compose, building first:

- `make integrations-keys-status` runs `docker-compose run --rm kerghan_app sh -c "yarn build && yarn integrations:keys:status"`.
- `make integrations-keys-reencrypt` runs the same command with `yarn integrations:keys:reencrypt`.

## Notes
- **Rolling deploys.** If several instances run behind a rolling deploy, an old instance can't decrypt a row that a new instance has already re-encrypted, lazily or by command.
  - The docs must say to run `reencrypt` only once every instance runs the new config.
  - Lazily re-encrypted rows are readable only by new-config instances. Document the same three-phase variant used for `KERGHAN_SECRET_KEY`: new key as previous first, then swap.
- **Compromised key.** A leaked key should still be listed as previous only long enough to re-encrypt. The data it protects is already exposed, so re-encrypting doesn't undo the leak. Users should also rotate their GitHub credentials. Document this.
