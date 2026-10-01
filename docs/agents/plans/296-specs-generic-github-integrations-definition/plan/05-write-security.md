# Write `integrations/security.md`

Create `docs/agents/specs/integrations/security.md`, encoding the issue's security decisions:

- **Access rules / admin visibility** — owner-only; every route requires auth and is scoped to
  the current user; other users' integrations ⇒ 404 (never 403, no existence leak); admins
  (`@AdminOnly()`) get no access at all — no admin route or UI; password reset, recovery link
  and admin user edit leave integrations untouched.
- **Encryption at rest** — AES-256-GCM, fresh random 96-bit IV per encryption, re-encrypt with a
  new IV on every replace; AAD = integration `uuid` + `type` (state the exact concatenation, e.g.
  `"<uuid>:<type>"`); a ciphertext moved to another row fails to decrypt ⇒ `undecryptable`.
- **Key** — `KERGHAN_INTEGRATIONS_KEY`, independent of `KERGHAN_SECRET_KEY`; exactly 32 random
  bytes base64-encoded (`openssl rand -base64 32`); boot fails if missing, not valid base64, not
  exactly 32 bytes, equal to `KERGHAN_SECRET_KEY`, or (with `NODE_ENV=production`) equal to the
  public dev/test placeholder. Specify that #300 defines the placeholder value in the
  docker-compose / `.env` samples / CI and documents production generation in
  `environment-variables.md`.
- **Key id** — first 8 hex chars of SHA-256 over the raw key bytes, stored in `secret_key_id`;
  key-id mismatch ⇒ `undecryptable`; single key only, rotation deferred to #305 (no
  `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`, no re-encryption).
- **Secrets never logged** — the seven numbered rules from the issue (never-logged list,
  safe-to-log list, required `Secret` wrapper with redacted `toString`/`toJSON`/`util.inspect`,
  sanitized GitHub client errors, validation messages never echo the value, frontend input and
  state rules, canary tests), with the context about `core/logger.service.ts` and
  `HttpExceptionFilter` having no redaction. Tent body logging: no extra check required.
- **Rate limiting** — the rationale (token-checking oracle, shared IP blocking, quota burn);
  create/replace failure cool-off per user following `AccountEditAbuseGuardService` /
  `core/lockout-state.ts` (default 5 failures → 15 min, 423 `INTEGRATION_CREDENTIAL_LOCKED`,
  rejected before any GitHub call, success resets, transient failures don't count, DB table
  state, env vars `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` /
  `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS` read via `core/numeric-config.ts`); test cooldown per
  integration from `last_tested_at` (default 30 s via `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`,
  429 + `Retry-After`, no GitHub call); no global circuit breaker.
- **Faking GitHub** — all GitHub HTTP goes through one injectable GitHub client service; only
  its own spec stubs `fetch`; no new test dependency; CI never calls GitHub; manual smoke check
  documented per implementation issue.
- **Required tests** section — encryption (round-trip, fresh IV, tampered ciphertext/IV/tag/AAD
  row swap, key-id mismatch, all boot validation cases), `Secret` redaction, access (401
  unauthenticated, 404 foreign UUID, admin no access on every route), rate limiting (trips,
  resets, ignores transient, cooldown + `Retry-After`), canary (backend and frontend).

## Files to Change

- `docs/agents/specs/integrations/security.md` — new security spec.
