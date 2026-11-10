# Handle normalisation, validation and DTO

**Normalisation and validation helper**, in a new small module (for example `backend/src/auth/github-handle.ts`). It exports:

- `normalizeGithubHandle(value)`:
  - trims, strips **one** leading `@`, and lowercases;
  - an empty result returns `null`, and `null` stays `null`.
- the format `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$`.

**`UpdateAccountDto`** (account only; `UserFieldChangesDto` and `AdminUpdateUserDto` are untouched):

- Add `githubHandle?: string | null`:
  - normalised with `@Transform` (the pipe runs with `transform: true`);
  - validated after normalisation. A non-null value must match the format, with the field message `githubHandle must be a valid GitHub username`.
  - `null` (or a value normalising to `null`) is valid and means clear.
  - Any non-string, non-null type (number, boolean, object, array) answers `400 VALIDATION_FAILED`. Make sure the transform does not coerce such values into strings before validation.
- Make `currentPassword` optional (`@IsOptional() @IsString() @IsNotEmpty()`). Requiring it is moved to the service (step 03).
- **Reject `null` managed fields on this DTO only:** `null` for `username`, `email` or `newPassword` must answer `400 VALIDATION_FAILED`.
  - `@IsOptional()` lets `null` through, so override those three fields in `UpdateAccountDto` with `@ValidateIf((o) => o.<field> !== undefined)` in place of `@IsOptional()`, keeping their other validators.
  - The admin DTO keeps today's behaviour.

## Files to Change
- `backend/src/auth/github-handle.ts`: new; normalisation and the format constant/predicate.
- `backend/src/auth/dto/update-account.dto.ts`: `githubHandle`, optional `currentPassword`, `null`-rejecting overrides of the managed fields.
