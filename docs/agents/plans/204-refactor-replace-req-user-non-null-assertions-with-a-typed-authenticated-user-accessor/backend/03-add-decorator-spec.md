# Add a unit spec for the decorator

Add `backend/src/core/tests/current-user.decorator.spec.ts`, following this test folder's existing style (e.g. `admin.guard.spec.ts`, `boolean-metadata.spec.ts`). Test the exported `getCurrentUser` factory function directly, not the `@CurrentUser()` decorator wrapper (Nest's `createParamDecorator` output isn't directly callable/testable) — build a minimal mock `ExecutionContext` whose `switchToHttp().getRequest()` returns a plain object.

Cases to cover:
- **Present user**: `getCurrentUser(undefined, mockContext({ user: somePayload }))` returns `somePayload` unchanged.
- **Missing user**: `getCurrentUser(undefined, mockContext({}))` (no `user` key, i.e. `request.user` is `undefined`) throws `UnauthorizedException`.

## Files to Change
- `backend/src/core/tests/current-user.decorator.spec.ts` — new file, unit spec for `getCurrentUser` covering the present- and missing-user cases.
