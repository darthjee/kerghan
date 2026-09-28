# Frontend Plan: Define a standard API error response format and status-code mapping

Main plan: [plan.md](plan.md)

## Shared contracts

The frontend **consumes** the error body from [plan.md](plan.md#shared-contracts):
`{ error: { code, message, details? }, statusCode, timestamp }`. `error.message` and `error.code` are
always present on backend errors. `details` only appears on validation failures. A taken
username/email now arrives as `409` (`USERNAME_TAKEN` / `EMAIL_TAKEN`) instead of `400`, with the
same message.

## Implementation Steps

### Step 1 — Read the new error shape in `ApiClient` / `ApiError`
Change `ApiClient#sendJson` to throw `new ApiError(response.status, data?.error?.message, data?.error?.code, data?.error?.details)`
instead of `new ApiError(response.status, data.error)`. Guard against a missing or non-JSON body (for
example a proxy-generated error) by falling back to a generic message such as `response.statusText`
or `'Request failed'`, so `error.message` is never `undefined`. Extend `ApiError` with `code`
(string or `undefined`) and `details` (array or `undefined`) properties and document them. The `401`
refresh path is unchanged.

Existing consumers (`handleSubmitError`, `AdminUsersController`, `AuthorizationRequestsController`,
`RegisterController`, `AuthorizationRequestPoller`'s `404` check, `redirectIfForbidden`'s `403`
check) keep working unchanged: they read `.message` / `.status`, and none branch on `400` for a taken
username/email. Confirm this while implementing.

### Step 2 — Update specs and docs
Update `ApiClientSpec.js` mocks from `{ error: 'username is not available' }` to the new
`{ error: { code: 'USERNAME_TAKEN', message: 'username is not available' }, statusCode: 409, timestamp: '...' }`
shape. Assert that `message`, `code` and `details` are carried onto the thrown `ApiError`, and add a
case for the missing-body fallback. Add or update an `ApiError` spec for the new properties. Update the
other specs that mock `{ error: '...' }` response bodies (`AdminUsersControllerSpec.js`,
`AdminUsersHelperSpec.js`, `AuthorizationRequestsHelperSpec.js`,
`AuthorizationRequestsControllerSpec.js`) only where they mock a raw API response body. Specs that
build an `ApiError` or a result object directly need no change. Add a short `## API errors` note to
`docs/agents/architecture/frontend.md` describing `ApiError`'s `status` / `message` / `code` /
`details`, with a pointer to the backend's `## Error responses` section.

## Files to Change
- `frontend/assets/js/client/ApiClient.js` — read `data.error.message` / `code` / `details`, with a fallback.
- `frontend/assets/js/client/ApiError.js` — add `code` and `details`.
- `frontend/specs/assets/js/client/ApiClientSpec.js` — new-shape mocks and assertions.
- `frontend/specs/assets/js/client/ApiErrorSpec.js` — new or updated spec for the added properties.
- Other `frontend/specs/**` files mocking raw `{ error: '...' }` API bodies — update if applicable.
- `docs/agents/architecture/frontend.md` — `## API errors` note.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- This issue supersedes #42. Once it ships, #42 can be closed.
- The PHP proxy may return its own non-JSON error pages, which is why Step 1 needs the fallback.
  Reshaping proxy errors is out of scope.
