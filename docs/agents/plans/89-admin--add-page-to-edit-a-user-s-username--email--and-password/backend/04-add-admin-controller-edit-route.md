# Add the AdminController edit route

Add a route following this controller's existing `POST users/:id/....json` style:

```ts
@Post('users/:id/edit.json')
async edit(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: AdminUpdateUserDto,
  @Res({ passthrough: true }) res: Response,
): Promise<object> {
  const user = await this.adminService.editUser(id, dto);
  res.set(SKIP_CACHE_HEADER, 'true');

  return { user: this.#serializeUser(user) };
}
```

Reuses the controller's existing `#serializeUser` (already used by `search`) and `SKIP_CACHE_HEADER`
constant — no new response-shaping code. Guarded by the class-level `@AdminOnly()` already applied
to `AdminController`; no extra guard needed.

## Files to Change

- `backend/src/auth/admin.controller.ts` — add the `edit` route as above, importing
  `AdminUpdateUserDto`.
