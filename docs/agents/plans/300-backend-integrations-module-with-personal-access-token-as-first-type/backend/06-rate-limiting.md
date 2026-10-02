# Credential cool-off and test cooldown

Implement `security.md` "Rate limiting".

- **`IntegrationCredentialAbuseGuardService`:** modelled on `AccountEditAbuseGuardService` and
  `computeLockoutState`, but with **atomic** writes:
  - `isLockedOut(userId)` returns whether `locked_until > now`.
  - `registerFailure(userId)`:
    1. Run a single `INSERT … ON DUPLICATE KEY UPDATE failed_attempts = failed_attempts + 1`
       (QueryBuilder `orUpdate`, or a parameterised raw query).
    2. Re-read the row.
    3. If `failed_attempts >= max`, set `locked_until = now + lockMs` with a conditional
       `UPDATE`.

    Never read-then-write the counter.
  - `reset(userId)` sets `failed_attempts = 0` and `locked_until = NULL`.
  - Config comes from `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` and
    `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS`, through `getNumberConfig`, read in the
    constructor (once at boot).
  - When the counter resets after a lock expires: follow the existing guard's semantics. Once
    `locked_until` has passed, the next counted failure starts from the stored count. Document
    the choice in JSDoc, and keep it consistent with `computeLockoutState`.
- **Test cooldown** (`IntegrationTestCooldownService`, or a method on the integration store):
  - `claim(uuid, userId, now)` runs
    `UPDATE integrations SET last_tested_at = :now WHERE uuid = :uuid AND user_id = :userId AND
    (last_tested_at IS NULL OR last_tested_at < :now - cooldown)` and returns
    `{ claimed: true }`, or `{ claimed: false, retryAfterSeconds }`, the latter computed from the
    stored `last_tested_at`, rounded up and at least 1.
  - The cooldown comes from `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`, read at boot.
- Expose both behind narrow methods, so step 08 can swap in-memory doubles that keep the same
  atomic semantics.

Specs:
- The SQL / QueryBuilder shape is atomic. Assert on the mocked query builder: no
  `findOne` → `save` counter path.
- The lock trips at the configured max, resets on success, and config fallbacks apply.
- The cooldown claim and the `retryAfterSeconds` rounding.

## Files to Change
- `backend/src/integrations/integration-credential-abuse-guard.service.ts`: new.
- `backend/src/integrations/integration-test-cooldown.service.ts`: new.
- `backend/src/integrations/tests/integration-credential-abuse-guard.service.spec.ts`, `integration-test-cooldown.service.spec.ts`: new.
