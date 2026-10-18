# Search: status filter, status field, currentUserId

Extend `POST /admin/users/search.json` per the shared contract.

- `SearchUsersDto`: add optional `status` validated with `@IsOptional()` +
  `@IsIn(Object.values(UserStatus))`; an invalid value goes through the existing
  `ValidationPipe` → `400 VALIDATION_FAILED`.
- `AdminService#searchUsers(q?, status?)`: when `status` is given, add it to every `where`
  branch (`[{ username: ILike, status }, { email: ILike, status }]` with `q`, `{ status }`
  without) so it ANDs with `q`; absent → unchanged.
- `AdminController#search`: take `@CurrentUser()` and return
  `{ users, currentUserId: currentUser.sub }`.
- `#serializeUser`: add `status`. It is shared by `edit.json`, so its `user` gains `status` too,
  consistent with "every admin user item gains `status`".
- Tests: `admin.service.spec.ts` (status alone, status + q, none); `admin.controller.e2e-spec.ts`
  (filter alone and combined with `q`, invalid status → `400 VALIDATION_FAILED`, items carry
  `status` and no secret fields, `currentUserId` is the caller's id, `edit.json` response carries
  `status`).

## Files to Change

- `backend/src/auth/dto/search-users.dto.ts` — `status` field.
- `backend/src/auth/admin.service.ts` — `searchUsers` status filter.
- `backend/src/auth/admin.controller.ts` — pass `status`, add `currentUserId`, serialize `status`.
- `backend/src/auth/tests/admin.service.spec.ts` — unit specs.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — e2e specs.
