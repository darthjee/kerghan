# Controller and module wiring

Thin controller, each route individually `@Public()` (per-method, matching every existing
`AuthController` route — never a class-level `@Public()` on `@Controller('auth')`).

## Controller

- `@Controller('auth')`.
- `POST /auth/authorization-requests.json` — `@Public()`. Body: `CreateAuthorizationRequestDto`.
  Uses `client-request.ts` (Step 2) to capture `{ ip, userAgent }` from the raw request and passes
  them as plain args to `AuthorizationRequestService#create`. Sets `X-Skip-Cache: true`.
- `POST /auth/authorization-requests/:uuid/poll.json` — `@Public()`. Body:
  `PollAuthorizationRequestDto`. Calls `AuthorizationRequestService#poll(uuid, pollToken)`. On the
  winning `approved` response, sets the `access_token` cookie the same way `AuthController` does
  (via the Step 2 `auth-response.ts` helper) before returning the body. Sets `X-Skip-Cache: true`
  on every response regardless of status.

## Module wiring

- `backend/src/auth/auth.module.ts`:
  - Add `AuthorizationRequest` to `TypeOrmModule.forFeature([...])`.
  - Register `AuthorizationRequestController` in `controllers`.
  - Register `AuthorizationRequestService` in `providers`.
  - No new `exports` entry — the service stays internal, same as `PasswordResetService`.

## Files to Change

- `backend/src/auth/authorization-request.controller.ts` — new, as described above.
- `backend/src/auth/auth.module.ts` — add the entity, controller, and service.
