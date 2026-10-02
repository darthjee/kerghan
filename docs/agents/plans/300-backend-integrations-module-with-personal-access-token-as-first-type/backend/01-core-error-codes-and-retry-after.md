# Core: error codes, 422 category, Retry-After

Extend the standard error format so the integrations module can raise every code in
`api.md#error-codes`.

- Add the specific codes to `ErrorCodes`:
  - `INTEGRATION_FLOW_UNSUPPORTED`, `INTEGRATION_REDIRECT_STATE_INVALID`
  - `INTEGRATION_LABEL_TAKEN`, `INTEGRATIONS_LIMIT_REACHED`
  - `INTEGRATION_CREDENTIAL_INVALID`, `INTEGRATION_INSUFFICIENT_PERMISSIONS`
  - `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`, `INTEGRATION_INSTALLATION_SUSPENDED`
  - `INTEGRATION_CREDENTIAL_LOCKED`, `INTEGRATION_TEST_COOLDOWN`
  - `GITHUB_UNAVAILABLE`, `GITHUB_RATE_LIMITED`

  The two redirect/installation groups are only defined here; #302/#303 use them. Adding them now
  matches "every new specific code above is added to `ErrorCodes`".
- Add a `422 → UNPROCESSABLE_ENTITY` category code (plus the `ErrorCodes.UNPROCESSABLE_ENTITY`
  constant), so a bare 422 never renders as `HTTP_422`. Also add `502 → BAD_GATEWAY` and
  `503 → SERVICE_UNAVAILABLE` category codes for consistency. The specific codes still take
  precedence.
- Check that `LockedException` can carry a specific code (`INTEGRATION_CREDENTIAL_LOCKED`). Today
  it takes a plain message, so add an optional `code` the filter picks up, without changing the
  existing callers' bodies.
- **`Retry-After`:** add a core way for a throw site to attach a `Retry-After` header (integer
  seconds, rounded up). For example, an optional `retryAfterSeconds` in the exception's response
  object, which `HttpExceptionFilter` turns into the header and strips from the body. Nothing in
  the backend emits this header yet.

Specs: extend `core/tests/http-exception.filter.spec.ts` for 422/502/503 category codes, the
specific-code path on `LockedException`, and the `Retry-After` header (present when set, absent
otherwise, never in the body).

## Files to Change
- `backend/src/core/error-codes.ts`: the new specific and category codes.
- `backend/src/core/locked.exception.ts`: optional specific `code`.
- `backend/src/core/http-exception.filter.ts`: write the `Retry-After` header.
- `backend/src/core/tests/http-exception.filter.spec.ts`, `backend/src/core/tests/` (error-codes spec if present): specs.
