# Dedupe account e2e spec
In `auth.controller.account.e2e-spec.ts` (`PATCH /auth/account.json`), `updates the username and responds with { username, email }` and `sets the X-Skip-Cache header` send the identical request (`currentPassword: 'my-password', username: 'new-username'` with a logged-in cookie). Wrap both in a `describe('with the right current password')` whose `beforeEach` does `loginCookie` + the PATCH and stores the response; keep the body assertion and the `x-skip-cache` assertion as separate `it`s.

Then check the rest of the file (and `auth.controller.guard.e2e-spec.ts`, which the issue cross-references) for remaining repeated `loginCookie` + request boilerplate — e.g. the refresh-token test extracts the cookie by hand (`login.headers['set-cookie'][0].split(';')[0]`) while others use `loginCookie`; extract a local request function (e.g. `patchAccount(cookie, body)`) if several tests repeat the `.patch(...).set('Cookie', ...).send(...)` chain. Do not force a helper into `auth.controller.guard.e2e-spec.ts` if the block the issue mentions no longer exists there.

## Files to Change
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts` — shared-`beforeEach` describe for the success/skip-cache pair; optional local `patchAccount` helper for the repeated chain.
- `backend/src/auth/tests/auth.controller.guard.e2e-spec.ts` — only if a real duplicate remains after the account refactor.
