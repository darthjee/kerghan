# security.md

Define the authentication gate and non-disclosure rules in
`docs/agents/specs/user-approval/security.md`.

- **`sid` claim:** the access token carries the refresh-token session's `sessionUuid`.
- **Session lookup in `JwtGuard`:** on every non-`@Public()` request, after the signature check,
  load an active (unrevoked, unexpired) refresh-token row for `sid`, joined to its user; allow
  only when the row exists, `row.userId === sub` and the user is `approved` (whatever the flag).
  Otherwise `401`, as for an anonymous caller. One indexed query (`session_uuid` index).
- **`request.user` from the DB:** `{ sub, sid, username, isAdmin }` built from the joined user
  row, not from the claims; `AdminGuard` / `@CurrentUser()` unchanged. Claims stay in the token
  but are not trusted for authorization.
- **Tokens without `sid`:** rejected with `401`, no legacy path; explain why this logs no one
  out (refresh-and-retry in `ApiClient`, refresh mints a `sid` token for the same session) and
  the rejected alternative.
- **Delivery order:** #391 ships the `sid` claim, the session lookup and `request.user` from the
  DB without status logic; #392 adds the `approved` requirement.
- **Explicit exceptions** that read the real status: login, `status.json`, recover / reset,
  device-authorization `poll` (details in `api.md`). Business endpoints never check status.
- **Non-disclosure:** a denied account is indistinguishable from logged-out / unknown everywhere
  except login after a correct password; recovery side effects identical for every status.
- **Immediate effects:** deny, logout, session revoke, revoke-others and admin demotion take
  effect on the next request.
- **Required tests:** guard with active / revoked / expired / foreign session, missing `sid`,
  rotation keeps working, non-approved user rejected, `request.user` reflects DB changes
  (demotion, rename), denied indistinguishable from logged out.

## Files to Change
- `docs/agents/specs/user-approval/security.md` — new: `sid` gate, `request.user`, legacy
  tokens, exceptions, non-disclosure, required tests.
