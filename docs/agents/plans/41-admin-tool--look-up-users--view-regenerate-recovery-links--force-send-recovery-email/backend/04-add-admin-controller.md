# Add AdminController and wire into AuthModule

New file `backend/src/auth/admin.controller.ts`, `AdminController`, mirroring
`AuthController`'s thin-controller style (delegates to `AdminService`, sets the response header
itself since that's route-response plumbing, not business logic):

- `@Controller('admin')` with `@AdminOnly()` applied at the controller level (every route needs
  it; no route here should be reachable by a non-admin). No `@Public()` anywhere — these routes
  need the default `JwtGuard` behavior so `request.user` is populated for `AdminGuard`.
- `POST users/search.json` — `@Body() dto: SearchUsersDto` (new DTO, single optional `q?: string`
  field, `@IsOptional() @IsString()`) — `POST` with a body, not `GET`, matching this module's
  existing convention of `POST`-with-body even for read-only checks (`status.json`); calls
  `adminService.searchUsers(dto.q)`, serializes each user to `{ id, username, email, isAdmin,
  createdAt }` (new private `#serializeUser`, distinct from `AuthController`'s `#serialize` since
  this one includes `isAdmin`/`createdAt` for an admin audience), sets `X-Skip-Cache`, returns `{
  users: [...] }`.
- `POST users/:id/recovery-link.json` — `@Param('id', ParseIntPipe) id: number`, calls
  `adminService.generateRecoveryLink(id)`, sets `X-Skip-Cache`, returns `{ resetUrl }`.
- `POST users/:id/send-recovery-email.json` — same `id` param, calls
  `adminService.sendRecoveryEmail(id)`, sets `X-Skip-Cache`, returns `{ sent }`.

Wire it into `auth.module.ts`: add `AdminController` to `controllers`, `AdminService` to
`providers`. No new module import needed — `User`, `PasswordResetService`, and `MailModule` (for
`MailService`) are already available in `AuthModule`'s scope.

## Files to Change

- `backend/src/auth/admin.controller.ts` — new file.
- `backend/src/auth/dto/search-users.dto.ts` — new file.
- `backend/src/auth/auth.module.ts` — register `AdminController`/`AdminService`.
