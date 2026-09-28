# Add the global exception filter

Create `backend/src/core/http-exception.filter.ts` — a `@Catch()` (catch-all) `ExceptionFilter`
injected with `LoggerService` that writes the error body from the shared contract:

- **`HttpException`**: read `getStatus()` and `getResponse()`.
  - If the response is an object with a `code` string, use it as `error.code` (specific code).
  - If `response.message` is an array (the `ValidationPipe` shape), set `details` to the array,
    `message` to the entries joined with `"; "`, and default the code to `VALIDATION_FAILED`.
  - Otherwise `message` is `response.message` (object response) or the string response.
  - With no specific code, map the status to its category code (table in plan.md).
- **Anything else**: respond `500` with `{ code: 'INTERNAL_ERROR', message: 'Internal server error' }`
  and log the full error through `logger.error('unhandled exception', { error, stack, ... })`. Never
  put the error message or stack in the response.
- Always add `statusCode` and `timestamp: new Date().toISOString()`.

Keep the status→code mapping in a small exported constant/function (e.g.
`backend/src/core/error-codes.ts`) exporting the category codes and the specific codes
(`USERNAME_TAKEN`, `EMAIL_TAKEN`), so throw sites and specs import the constants instead of repeating
strings.

Register it in `AppModule` as `{ provide: APP_FILTER, useClass: HttpExceptionFilter }`, and do the
same in the shared e2e builder (`build-auth-test-app.ts`) and in `request-logging.e2e-spec.ts`'s test
module so e2e specs exercise the real shape. Add unit specs for the filter covering: plain string
`HttpException`, object response with `code`, `ValidationPipe` array → `details`, each category code,
an unknown status, and a non-HTTP error (500 + logged, no leaked message).

## Files to Change
- `backend/src/core/http-exception.filter.ts` — new global filter.
- `backend/src/core/error-codes.ts` — new category/specific code constants and status→code mapping.
- `backend/src/core/tests/http-exception.filter.spec.ts` — new unit specs.
- `backend/src/app.module.ts` — register the `APP_FILTER` provider; update the module doc comment.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — register the same `APP_FILTER` provider.
- `backend/src/core/tests/request-logging.e2e-spec.ts` — register the filter in its test module.
- `backend/src/core/tests/app.module.spec.ts` — update if it asserts the provider list.
