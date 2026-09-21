# Apply helpers to the admin spec
In `admin.controller.e2e-spec.ts`:

- Replace the `let app`/`let userRepo` declarations and `beforeEach`/`afterEach` with `const ctx = useTestApp({ adminGuard: true, registerDefaultUser: false });`.
- Delete the local `registerAndLogin(username, email)` helper: it becomes `await registerUser(ctx.app, { username, email }); return loginCookie(ctx.app, username);` at its call sites (or a one-line local wrapper if that keeps call sites readable).
- In the nested `beforeEach` that registers `darthjee` and `obi-wan` and logs in as the admin, use `registerUser` for both register calls and `loginCookie(ctx.app, 'obi-wan')` for the admin cookie; `userRepo` is read via `ctx.userRepo`.
- Leave the test bodies and assertions untouched.

## Files to Change
- `backend/src/auth/tests/admin.controller.e2e-spec.ts`
