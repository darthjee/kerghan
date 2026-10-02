# Type contract, registry and PAT strategy

Implement `type-contract.md` and `types/pat.md`.

- **Contract types** (`integrations/types/integration-type-strategy.ts`):
  `IntegrationTypeStrategy`, `ValidatedCredential`, `TestOutcome` and `IntegrationView`, as
  sketched in the spec. Validation failures inside a strategy throw typed domain errors, e.g.
  `CredentialInvalidError`, `InsufficientPermissionsError`, `GithubUnavailableError`, and
  `GithubRateLimitedError(retryAfterSeconds?)`.
  - Map them to HTTP in the service layer (step 07), not in the strategy.
  - Flag whether each one counts toward the cool-off.
- **Registry** (`IntegrationTypeRegistry`):
  - Strategies are registered by `type` through a multi-provider token, in registry order.
  - `get(type)` looks one up and throws on an unknown type.
  - `enabledTypes()` returns `[{ type, flows }]` for `POST /integrations/types.json`, through an
    optional `isEnabled()` on the strategy (`pat` is always enabled).
  - The generic code never branches on `type` outside the registry.
- **`PatStrategy`:**
  - `flows: { credentialPaste: true, redirect: false }`.
  - `parseCredential(raw)` follows the exact validation order in "credential request shape":
    - exactly one key, `token`;
    - a string, trimmed, 1–255 characters, `[A-Za-z0-9_]`;
    - a `ghp_` or `github_pat_` prefix.

    It throws `BadRequestException` with `VALIDATION_FAILED` and field-only messages, and returns
    `new Secret({ token })`.
  - `validate(secret)` makes one `getUser` call and handles:
    - the error mapping table: 401 → invalid, rate limit, 5xx / network / unexpected / no
      `login` → unavailable;
    - classic `repo` scope check;
    - metadata `{ tokenKind, scopes, permissionsVerified }`;
    - `expiresAt` parsed from `github-authentication-token-expiration` (UTC and numeric offset;
      unparseable → `null` plus a safe-field warning through `LoggerService`).
  - `test(secret, current)` follows the test table, including 401 with a past
    `current.expiresAt` → `expired`, and otherwise `bad_credentials`.
  - `describeMetadata` uses the strict three-key shape.
  - `mask` returns the prefix + `…` + last 4.
  - `onDelete` is a no-op, with no GitHub call.
  - Decrypted payloads are re-validated against `{ token }`; a mismatch is treated as
    undecryptable (expose a `parseSecretPayload` the service uses after decrypting).
- **Rate-limit detection:** 403/429 with `x-ratelimit-remaining: 0` or a `retry-after` header.
  `retryAfterSeconds` comes from `retry-after`, or else from `x-ratelimit-reset` minus now,
  rounded up and never negative.

Specs: every item in `types/pat.md` "Required tests" and the registry items in
`type-contract.md`, run against the fake GitHub client, with a canary token asserted absent from
logger calls, thrown errors, metadata and the hint (beyond its last 4 characters).

## Files to Change
- `backend/src/integrations/types/integration-type-strategy.ts`: new.
- `backend/src/integrations/types/integration-type-registry.ts`: new.
- `backend/src/integrations/types/pat/pat.strategy.ts` (plus small helpers for scopes, expiry and rate limit): new.
- `backend/src/integrations/integration-errors.ts`: new domain errors.
- `backend/src/integrations/tests/pat.strategy.spec.ts`, `integration-type-registry.spec.ts`: new.
