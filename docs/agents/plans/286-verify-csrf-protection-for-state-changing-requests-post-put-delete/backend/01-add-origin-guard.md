# Add OriginGuard
Create a global CSRF guard in `backend/src/core/` that implements the decision table from the main plan's shared contracts.

- Put the decision in a pure exported function, e.g. `isCrossSiteRequestAllowed({ method, secFetchSite, origin, host }, trustedOrigins)`, where `trustedOrigins` is `string[] | true`. Only this function knows the table.
- `OriginGuard implements CanActivate`: in its constructor, inject `ConfigService` and resolve `buildCorsOptions(configService)?.origin ?? []`. In `canActivate`, read the Express request headers (`sec-fetch-site`, `origin`, `host`) and throw `ForbiddenException` when the function returns `false`.
- Compare origins exactly (`Origin` is already a serialized origin). For the `Host` fallback, parse `Origin` with `URL` and compare `url.host` to the `Host` header. Treat an unparseable `Origin` (including the literal `null`) as untrusted.
- Match the JSDoc style of `jwt.guard.ts` and `cors-config.ts`, and explain why each row of the table exists.
- Unit-test every row of the decision table, the safe methods, `trustedOrigins === true`, the empty list, the `null` origin, and the `Host` fallback. Also check that the guard throws `ForbiddenException` when the decision is to reject.

## Files to Change
- `backend/src/core/origin.guard.ts` — new: the decision function and `OriginGuard`.
- `backend/src/core/tests/origin.guard.spec.ts` — new: unit specs.
