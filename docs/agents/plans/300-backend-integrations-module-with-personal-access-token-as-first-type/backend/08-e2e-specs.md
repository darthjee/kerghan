# E2E specs and final checks

Add HTTP-level specs that mirror the auth e2e layout (`auth/tests/support/build-auth-test-app.ts`
and the per-concern `*.e2e-spec.ts` files).

## Test-app builder

`integrations/tests/support/build-integrations-test-app.ts` wires:
- `ConfigModule` with overrides (a valid test key, small cooldown and limits);
- `JwtModule`, `LoggingModule`, `AuthModule` (to log in two users plus an admin) and
  `IntegrationsModule`;
- the global `OriginGuard`, `JwtGuard`, `AdminGuard`, `CachePolicyInterceptor` and
  `HttpExceptionFilter`;
- the global `ValidationPipe`, matching `main.ts`.

It also:
- overrides the repositories with `createInMemoryRepo`;
- swaps `GithubClientService` for the fake;
- swaps the atomic cool-off and cooldown services for in-memory doubles with the same
  semantics.

## Spec files (per concern)

- `integrations.controller.list-show.e2e-spec.ts`: list ordering, show, expiry on read,
  undecryptable rows (`secretHint: null`).
- `integrations.controller.create.e2e-spec.ts`:
  - success (201) and every create error row;
  - the check order with **no** GitHub call on cool-off, cap or duplicate label;
  - flow-unsupported (register a fake credential-less strategy in the builder only if needed;
    otherwise unit-test it at service level).
- `integrations.controller.rename-replace.e2e-spec.ts`.
- `integrations.controller.test-delete.e2e-spec.ts`: 200 with `invalid`/`expired`, transient
  502/503 leaving the status unchanged, cooldown 429 + `Retry-After`, delete 204.
- `integrations.controller.access.e2e-spec.ts`:
  - 401 unauthenticated on every route;
  - a foreign uuid → 404 with a body identical to a missing one, on every `:uuid` route;
  - 404 (not 400/423/429) on test and replace even in cooldown or with an invalid payload;
  - an admin gets 404 on another user's integration.
- `integrations.controller.skip-cache.e2e-spec.ts`: `X-Skip-Cache` and
  `Cache-Control: no-store` on every route.
- `integrations.controller.csrf.e2e-spec.ts`: a cross-site POST/PATCH/DELETE → 403.
- Response shape: no response contains the credential, `secret*`, the internal `id` or
  `userId`. The canary token appears in no response body and no logger spy call.

## Final checks

Run inside docker-compose:
- `yarn lint`
- `yarn coverage`, meeting the project's coverage thresholds

Then ask for the security, data-access and cache agents' reviews.

## Files to Change
- `backend/src/integrations/tests/support/build-integrations-test-app.ts`: new.
- `backend/src/integrations/tests/support/in-memory-*.ts`: in-memory doubles for the atomic services.
- `backend/src/integrations/tests/integrations.controller.*.e2e-spec.ts`: new, per concern.
