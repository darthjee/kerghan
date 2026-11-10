# Read route and Auth export

**`POST /auth/account/mine.json`** on `AuthController`:

- authenticated: the default `JwtGuard`, not `@Public()`;
- `OriginGuard` covers it as a `POST`;
- cache class `Never` through the controller-level `@CachePolicy`;
- no body; returns `{ username, email, githubHandle }` for the session's own user (`user.sub`), with no id in the request;
- answers `401` (`Invalid session`, same as `PATCH`) when the user no longer exists;
- the status is Nest's `POST` default, `201`.

Put the logic in a service method (for example `AccountService#getAccount(userId)`, or the new `AccountHandleService` if `AccountService` is near its limit), so the controller stays thin.

**`AccountHandleService`**, a new provider in `backend/src/auth/account-handle.service.ts`:

- `getGithubHandle(userId: number): Promise<string | null>` returns the stored, normalised handle, or `null` when there is no handle or no such user;
- it is read-only.
- Register it in `AuthModule.providers` and add it to `exports`: `[AuthService, SESSION_LOOKUP, AccountHandleService]`.
- Update the module docblock that lists the exports.

## Files to Change
- `backend/src/auth/auth.controller.ts`: new `mine.json` route.
- `backend/src/auth/account.service.ts` (or the new service): the account read method.
- `backend/src/auth/account-handle.service.ts`: new exported provider.
- `backend/src/auth/auth.module.ts`: provider, export and docblock.
