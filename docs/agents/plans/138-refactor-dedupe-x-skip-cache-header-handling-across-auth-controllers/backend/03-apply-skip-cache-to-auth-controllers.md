# Apply @SkipCache() to the three auth controllers

Every route in all three controllers needs `X-Skip-Cache`, so annotate each controller class itself with `@SkipCache()` (same style as `admin.controller.ts`'s existing class-level `@AdminOnly()`) rather than annotating individual handlers. Then remove every now-redundant manual `res.set(SKIP_CACHE_HEADER, 'true')` call:

**`backend/src/auth/admin.controller.ts`**
- Add `@SkipCache()` at the class level.
- Delete the locally redeclared `const SKIP_CACHE_HEADER = 'X-Skip-Cache';` (the constant that named this issue) — it becomes unused once the manual `res.set` calls below are removed, so no import replaces it either.
- Remove the `res.set(SKIP_CACHE_HEADER, 'true')` call from `edit`, `recoveryLink`, `search`, and `sendRecoveryEmail`. In all four, `res`/`@Res()` then has no remaining use — drop the `@Res({ passthrough: true }) res: Response` parameter and, if `Response` becomes unused in the file, its import too.

**`backend/src/auth/auth.controller.ts`**
- Add `@SkipCache()` at the class level (it already imports `SKIP_CACHE_HEADER` from `./auth-response.js` — that import becomes unused once the calls below are removed and should be dropped).
- Remove the `res.set(SKIP_CACHE_HEADER, 'true')` call from `updateAccount`, `recover`, `resetPassword`, and `status` — in these four, drop the now-unused `@Res()`/`Response` param the same way as above.
- Remove the `res.set(SKIP_CACHE_HEADER, 'true')` call from `logout`, but keep its `@Res({ passthrough: true }) res: Response` parameter — `logout` still needs `res` for `res.clearCookie(...)`.
- `login`, `refresh`, and `register` have no direct `res.set` call (they delegate to `respondWithSession`) — leave them as-is; the class-level `@SkipCache()` plus `respondWithSession`'s own header-set (see [backend.md](../backend.md)'s Notes) both still result in the header being set.

**`backend/src/auth/authorization-request.controller.ts`**
- Add `@SkipCache()` at the class level (drop the `SKIP_CACHE_HEADER` import from `./auth-response.js` once it becomes unused).
- Remove the `res.set(SKIP_CACHE_HEADER, 'true')` call from `create`, `mine`, `authorize`, and `deny` — drop the now-unused `@Res()`/`Response` param in each.
- In `poll`, remove only the `res.set(SKIP_CACHE_HEADER, 'true')` call on the non-approved branch; keep `@Res({ passthrough: true }) res: Response` since the approved branch still needs `res` for `respondWithSession`.

Double-check each file's `Response`/`SKIP_CACHE_HEADER` imports after these edits — remove any that are no longer referenced.

## Files to Change
- `backend/src/auth/admin.controller.ts` — add class-level `@SkipCache()`, delete the local `SKIP_CACHE_HEADER` redeclaration, remove 4 manual `res.set` calls, drop `@Res()`/`Response` from `edit`/`recoveryLink`/`search`/`sendRecoveryEmail`.
- `backend/src/auth/auth.controller.ts` — add class-level `@SkipCache()`, remove the `SKIP_CACHE_HEADER` import, remove 5 manual `res.set` calls (`updateAccount`, `recover`, `resetPassword`, `status`, `logout`), drop `@Res()`/`Response` from `updateAccount`/`recover`/`resetPassword`/`status` (keep it on `logout`, `login`, `refresh`, `register`).
- `backend/src/auth/authorization-request.controller.ts` — add class-level `@SkipCache()`, remove the `SKIP_CACHE_HEADER` import, remove 5 manual `res.set` calls (`create`, `mine`, `authorize`, `deny`, `poll`'s non-approved branch), drop `@Res()`/`Response` from `create`/`mine`/`authorize`/`deny` (keep it on `poll`).
