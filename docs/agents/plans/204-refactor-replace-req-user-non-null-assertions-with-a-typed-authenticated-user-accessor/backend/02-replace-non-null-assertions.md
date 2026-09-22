# Replace req.user! with @CurrentUser() in the four handlers

In both controllers, swap the `@Req() req: Request` parameter for `@CurrentUser() user: AccessTokenPayload` wherever the handler's only use of `req` was reading `req.user!.sub`, and read `user.sub` instead. Where a handler still needs `req` for something else (e.g. `create()`'s IP/User-Agent extraction, which is `@Public()` and out of scope here), leave `@Req()` in place — this issue only touches the four authenticated call sites already using `req.user!`.

`backend/src/auth/auth.controller.ts`:
- `updateAccount()` (currently `req.user!.sub` at line 57) — replace the `@Req() req: Request` param with `@CurrentUser() user: AccessTokenPayload`, call `this.accountService.updateAccount(user.sub, dto)`. Update the JSDoc `@param` line that currently documents `req` to document the new `user` param instead.

`backend/src/auth/authorization-request.controller.ts`:
- `mine()` (line 96) — same swap, `this.authorizationRequestService.listOpenForUser(user.sub)`.
- `authorize()` (line 120) — same swap; keep the other params (`uuid`, `dto`) untouched, call `this.authorizationRequestService.authorize(uuid, user.sub, dto.password)`.
- `deny()` (line 136) — same swap, `this.authorizationRequestService.deny(uuid, user.sub)`.
- Update each JSDoc `@param {Request} req` line to describe the new `user` param, and the class-level doc comment's `req.user!.sub` mention (around line 21) to drop the `!`.

Import `CurrentUser` from `../core/current-user.decorator.js` and `AccessTokenPayload` (type-only) from `../core/access-token-payload.js` in both files; drop the now-unused `Req` import and `Request` type import from each file if nothing else in that file still uses them (re-check `create()` and `poll()` in `authorization-request.controller.ts`, which do still need `Request`/`@Req()`).

## Files to Change
- `backend/src/auth/auth.controller.ts` — `updateAccount()`: `@Req() req` → `@CurrentUser() user`, drop `req.user!.sub` → `user.sub`; update imports and JSDoc.
- `backend/src/auth/authorization-request.controller.ts` — `mine()`, `authorize()`, `deny()`: same swap; keep `@Req()`/`Request` for `create()`/`poll()`; update imports and JSDoc (including the class-level comment).
