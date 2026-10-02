# Backend Plan: Frontend: Integrations page and My account menu item

Main plan: [plan.md](plan.md)

## Shared contracts

Produce `nextTestAt` on every Integration response: `string | null`, ISO-8601, equal to `lastTestedAt + KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`, or `null` when `lastTestedAt` is `null`. It may lie in the past.

## Implementation Steps

### Step 1 — Add `nextTestAt` to the Integration response
The cooldown window lives in `IntegrationTestCooldownService` (`cooldownMs`, read once from `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`). Expose a small method on it (e.g. `nextTestAt(lastTestedAt: Date | null): Date | null`), so the window stays defined in one place. Inject the cooldown service into `IntegrationsService`, and have its private `respond(row)` pass the computed value into `toIntegrationResponse`. That function is the only serializer, so every route gets the field. Add `nextTestAt: string | null` to the `IntegrationResponse` interface and to the allowlisted body, formatted with `isoOrNull`. Keep the controller untouched.

Tests:
- unit specs for the new cooldown-service method (`null` input, a date input, a custom cooldown config);
- `integration-response` / service specs covering the field;
- the existing e2e specs (list/show, create, rename/replace, test) assert `nextTestAt` in the bodies, including `null` before the first test and a value after one.

Update the in-memory test double (`tests/support/in-memory-integrations.ts`) if it builds responses or mocks the cooldown service.

### Step 2 — Update the specs
- `docs/agents/specs/integrations/api.md`: add `nextTestAt` to the *Integration response* example and bullets, with its definition (above).
- `docs/agents/specs/integrations/ui.md`: change the *Test connection* cooldown rule to "disabled until `nextTestAt`, and, after a 429, for the `Retry-After` seconds".

## Files to Change
- `backend/src/integrations/integration-test-cooldown.service.ts`: new `nextTestAt` method.
- `backend/src/integrations/integration-response.ts`: `nextTestAt` in the interface and the serializer.
- `backend/src/integrations/integrations.service.ts`: inject the cooldown service and pass `nextTestAt` in `respond`.
- `backend/src/integrations/integrations.module.ts`: only if the provider wiring needs it (the service is likely already provided).
- `backend/src/integrations/tests/*`: unit and e2e assertions, plus test doubles.
- `docs/agents/specs/integrations/api.md`, `docs/agents/specs/integrations/ui.md`: the contract update.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` and `yarn coverage` (CI jobs run `npm run lint` / `npm run coverage` in `backend/`); use the service name defined in `docker-compose.yml`.

## Notes
- `nextTestAt` is derived from `lastTestedAt` plus the cooldown, which is non-secret, so nothing new leaks. Still, the data-access agent must review the new response field, per its scope.
- No new route, so no cache-policy or Navi change.
