# security.md: errors and Add verification

- `## Errors and logging`: replace the #446 open marker with a link to the error table in
  `api.md` (anchor `api.md#errors`) and the rule that sync failures surface only as
  per-source statuses, never as HTTP errors; GitHub bodies and credential details are never
  echoed; anything unexpected is `500 INTERNAL_ERROR`.
- `## Add verification`: mention the repo ref (`fullName` resolves only among the caller's own
  rows, so it cannot reach repos outside the listing), the check order (rate limit → own-rows
  lookup → re-check), the identical `404` message, and the per-user values (link to `api.md#add`).
- `## CSRF`: every route is now `POST`, so `OriginGuard` covers all four (not only Refresh and
  Add).
- `## Required tests`: add "every `404` carries the same message" and "a `fullName` ref never
  resolves another user's row" if not already covered by api.md's list (link rather than
  duplicate).

## Files to Change
- `docs/agents/specs/repos/security.md` — settle `#errors-and-logging`, update Add verification
  and CSRF wording.
