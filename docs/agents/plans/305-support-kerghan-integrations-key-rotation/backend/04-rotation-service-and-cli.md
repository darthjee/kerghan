# Key rotation service and CLI commands
Add `IntegrationsKeyRotationService` to the integrations module. It holds all the logic and is unit-tested.

**`status(): Promise<KeyStatusLine[]>`**
- Runs `SELECT secret_key_id, COUNT(*) FROM integrations GROUP BY secret_key_id`.
- Labels each id `current`, `previous` or `unknown`.
- Adds the configured keys that have 0 rows.
- Orders the lines: current first, then previous in config order, then unknown.

**`reencrypt(): Promise<{ reencrypted; skippedUndecryptable; skippedChanged }>`**
- Iterates the rows whose `secret_key_id` is a previous id, in batches by `id` (e.g. 100), selecting only the columns it needs.
- For each row, calls `encryption.reencrypt`:
  - `null` adds to `skippedUndecryptable`. Log the uuid, and leave the row untouched.
  - Otherwise, runs the same `secret_key_id`-conditioned update as step 03. This is a system-wide query, so add an explicit non-owner-scoped method, named and documented as operator-only and never used from a request path. 0 affected rows adds to `skippedChanged`.
- It is idempotent: a second run finds nothing to do.

**CLI entrypoint `backend/src/integrations/cli/integrations-keys.ts`**
- It is thin: `NestFactory.createApplicationContext(AppModule)`, using the same `AppModule` so boot validation and DB config are identical to the server.
- It reads `process.argv[2]` (`status` | `reencrypt`; anything else prints usage and exits `2`).
- It calls the service and prints the lines defined in [plan.md](../plan.md#shared-contracts), then closes the app.
- It sets the exit code: `reencrypt` exits `1` when `skippedUndecryptable > 0`.
- Exclude it from coverage in `jest.config.ts`, alongside `main.ts`, with the same justification comment. All logic stays in the service.
- Check that `AppModule`'s application-context boot doesn't start anything long-running that would keep the process alive. If something does, close it explicitly.

**`backend/package.json` scripts:**
- `"integrations:keys:status": "node dist/integrations/cli/integrations-keys.js status"`
- `"integrations:keys:reencrypt": "node dist/integrations/cli/integrations-keys.js reencrypt"`

Tests in `integrations-key-rotation.service.spec.ts` should cover:
- status labelling and ordering, including zero-count configured keys and unknown ids
- reencrypt counts for each outcome
- batching across more than one batch
- idempotence on a second run
- that nothing secret is logged (assert on the logger spy)

## Files to Change
- `backend/src/integrations/integrations-key-rotation.service.ts` — new; the status and reencrypt logic.
- `backend/src/integrations/integration-store.service.ts` — the operator-only batch read and conditional rewrite methods, or keep them in the rotation service's own repository usage if that's clearer.
- `backend/src/integrations/integrations.module.ts` — register and export the service for the CLI context.
- `backend/src/integrations/cli/integrations-keys.ts` — new, the thin entrypoint.
- `backend/package.json` — the two scripts.
- `backend/jest.config.ts` — exclude `integrations/cli/**` from coverage.
- `backend/src/integrations/tests/integrations-key-rotation.service.spec.ts` — new.
