# Controller routes

Add the three authenticated routes to the existing `AuthorizationRequestController`
(`backend/src/auth/authorization-request.controller.ts`), alongside `create`/`poll`. Unlike those
two, none of the three get `@Public()` — the global `JwtGuard` (already registered as `APP_GUARD`)
protects them by default, populating `req.user` (`{ sub, username, isAdmin }`).

## Files to Change

- `backend/src/auth/authorization-request.controller.ts`:
  - `@Post('authorization-requests/mine.json')` — `mine(@Req() req: Request, @Res({ passthrough:
    true }) res: Response)`: `this.authorizationRequestService.listOpenForUser(req.user!.sub)`,
    set `SKIP_CACHE_HEADER`, return `{ requests }`.
  - `@Post('authorization-requests/:uuid/authorize.json')` — `authorize(@Param('uuid') uuid:
    string, @Body() dto: AuthorizeAuthorizationRequestDto, @Req() req: Request, @Res({
    passthrough: true }) res: Response)`: `await
    this.authorizationRequestService.authorize(uuid, req.user!.sub, dto.password)`, set
    `SKIP_CACHE_HEADER`, return `{ authorized: true }`.
  - `@Post('authorization-requests/:uuid/deny.json')` — `deny(@Param('uuid') uuid: string, @Req()
    req: Request, @Res({ passthrough: true }) res: Response)`: `await
    this.authorizationRequestService.deny(uuid, req.user!.sub)`, set `SKIP_CACHE_HEADER`, return
    `{ denied: true }`.
  - Import `AuthorizeAuthorizationRequestDto` from `./dto/authorize-authorization-request.dto.js`.
    `SKIP_CACHE_HEADER` is already imported from `./auth-response.js` — reuse it, don't redeclare.
  - Add matching JSDoc comments in the same style as the existing `create`/`poll` methods.
