# Carry Retry-After on ApiError
`ApiClient` drops response headers, so a 429's `Retry-After` never reaches callers. Extend `buildApiError` to read `response.headers.get('Retry-After')`, parse it as integer seconds, and pass it to `ApiError` as a new optional `retryAfter` property (`number | undefined`; `undefined` when absent or not a non-negative integer). Keep the existing constructor arguments and behavior intact.

Specs: `ApiErrorSpec` covers the new property. `ApiClientSpec` covers a 429 with and without `Retry-After`, plus an invalid value.

## Files to Change
- `frontend/assets/js/client/ApiClient.js`: read `Retry-After` in `buildApiError`.
- `frontend/assets/js/client/ApiError.js`: new optional `retryAfter` argument and property.
- `frontend/specs/assets/js/client/ApiClientSpec.js`, `frontend/specs/assets/js/client/ApiErrorSpec.js`: specs.
