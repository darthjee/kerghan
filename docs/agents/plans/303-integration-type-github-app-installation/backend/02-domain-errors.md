# Domain errors
The error codes already exist in `backend/src/core/error-codes.ts`. Add the missing domain errors
`InstallationNotAccessibleError` and `InstallationSuspendedError` (both counted toward the
cool-off via `countsTowardCoolOff`) and map them to 422 in `httpErrorFor`. Reuse the existing
`InsufficientPermissionsError`, `CredentialInvalidError`, `invalidRedirectState()`,
`flowUnsupported()`, `limitReached()`, `credentialLocked()`. Add type-local reason constants
`uninstalled` and `suspended` (like `OAUTH_APP_REASON_REVOKED`).

## Files to Change
- `backend/src/integrations/integration-errors.ts` — two new errors.
- `backend/src/integrations/integration-http-errors.ts` — 422 mapping.
- matching specs under `backend/src/integrations/tests/`.
