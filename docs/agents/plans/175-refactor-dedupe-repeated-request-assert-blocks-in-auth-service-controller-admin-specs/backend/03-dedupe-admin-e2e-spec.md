# Dedupe admin e2e spec
`admin.controller.e2e-spec.ts` (inside `when the caller is an admin`) has four endpoints, each with a body test and a separate `sets the X-Skip-Cache header` test that repeats the request:

- `POST /admin/users/search.json` — `returns every user when q is omitted` (`send({})`) ↔ skip-cache (`send({})`).
- `POST /admin/users/:id/recovery-link.json` — `mints a fresh recovery link…` ↔ skip-cache.
- `POST /admin/users/:id/send-recovery-email.json` — `responds with a sent boolean…` ↔ skip-cache.
- `POST /admin/users/:id/edit.json` — `updates the username, email, and password…` ↔ skip-cache. Note the skip-cache test currently sends only `{ username: 'darthjee-renamed' }`; the shared request should use the full body payload from the body test.

For each, wrap the pair in a nested `describe` (e.g. `describe('for an existing user')`) whose `beforeEach` issues the request with `adminCookie` and stores the response, keeping body and header as separate `it`s. Keep the other tests of each endpoint (other body cases such as `filters by q`, `responds 404 for an unknown user id`, 400 validation cases) outside that `describe`. `targetUserId`/`adminCookie` are set in the outer `beforeEach`, which runs before the nested one, so they are available.

Watch the 300-line file limit — check `wc -l` after the change (the refactor should shrink the file).

## Files to Change
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — four shared-`beforeEach` describes replacing the duplicated request/assert pairs.
