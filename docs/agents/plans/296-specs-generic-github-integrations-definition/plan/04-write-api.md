# Write `integrations/api.md`

Create `docs/agents/specs/integrations/api.md`:

- **Conventions** — `.json` routes; user-scoped reads use POST (Tent's cache key ignores the
  method; link `../../architecture/caching.md`); every route `@CachePolicy` class `never` and
  sends `X-Skip-Cache`; every route behind `JwtGuard`, scoped to the current user; foreign or
  missing UUID ⇒ 404; errors in the standard format (#283, `backend/src/core/error-codes.ts`);
  integrations exposed by UUID only.
- **Routes table** — exactly the seven routes from the issue (list mine, show, create, rename,
  replace credential, test, delete) with method, path, body, success status and response.
- **Create envelope** — `{ label, provider, type, credential: { …type-specific } }`; the
  `credential` shape is defined per type; only credential-paste types may use create/replace;
  redirect-based types own routes under `/integrations/<type>/…` (defined in #298/#299).
- **Integration response** — the JSON shape from the issue (`id` = uuid, `provider`, `type`,
  `label`, `status`, `statusReason`, `secretHint`, `metadata`, `expiresAt`, `lastTestedAt`,
  `lastTestResult`, `createdAt`, `updatedAt`); secrets, IV, tag, ciphertext and key id are never
  returned; `secretHint` format is type-defined via the type contract; `status` reflects the
  computed-on-read expiry.
- **Error codes table** — use the decisions listed in `plan.md`'s Notes (duplicate label 409
  `INTEGRATION_LABEL_TAKEN`; cap 409 `INTEGRATIONS_LIMIT_REACHED`; payload validation 400
  `VALIDATION_FAILED`; credential invalid 422 `INTEGRATION_CREDENTIAL_INVALID`; insufficient
  permissions 422 `INTEGRATION_INSUFFICIENT_PERMISSIONS`; cool-off 423
  `INTEGRATION_CREDENTIAL_LOCKED`; test cooldown 429 `INTEGRATION_TEST_COOLDOWN` + `Retry-After`;
  GitHub unavailable 502 `GITHUB_UNAVAILABLE` / rate limited 503 `GITHUB_RATE_LIMITED`; 401 / 404
  generic). Note that #300 adds the new specific codes to `ErrorCodes` and a 422 category
  mapping, and introduces `Retry-After` (not used anywhere yet).
- **Per-action behaviour** — on create failure nothing is stored; on replace failure the previous
  credential/status is unchanged; on test transient failure the status is unchanged, the attempt
  is recorded, and the error returned; rename leaves status unchanged.
- **Navi** — none of these routes are warmed.
- **Required tests** section — per action success/error codes, response never contains secret
  fields, never-cache policy + `X-Skip-Cache` (split e2e specs like
  `auth.controller.skip-cache.e2e-spec.ts` / `…csrf.e2e-spec.ts`), CSRF on state-changing
  routes per #286's convention.

## Files to Change

- `docs/agents/specs/integrations/api.md` — new API contract.
