# Issue: Log password-recovery requests and found/not-found outcome

## Description

Split from #49 (see that issue for the full design rationale). Depends on #49 sub-issue 1 (the
Core logger service — `backend/src/core/logger.service.ts`, already landed). This sub-issue adds
#49's logging points #4 and #5, both in `PasswordResetService`/the `password-recovery.requested`
event flow: logging that a password-recovery request was made, and logging whether the submitted
user was found or not.

#49 sub-issue 2 (request correlation — `RequestContextService`/`RequestContextMiddleware`,
`backend/src/core/`) has also already landed and is applied globally to every route via
`AppModule`. `LoggerService` already merges the active request's `requestId` into every log line
automatically, so no manual correlation work is needed in this sub-issue — the log calls added here
get it for free.

## Problem

`POST /auth/recover.json`'s flow (`PasswordResetService#recover`,
`events/password-recovery-requested.listener.ts` — see `docs/agents/modules/auth.md`'s
"`password-recovery.requested` event" section) currently has no logging of the request itself, and
no visibility into whether the submitted email matched an existing account.

## Expected Behavior

- Every call to `PasswordResetService#recover` logs that a password-recovery request was received.
- The same flow logs whether the submitted user was found or not.
- **Deliberate, already-made decision** (not open for re-discussion in this sub-issue): the
  found/not-found log line includes the submitted email/username. The standard anti-enumeration
  trade-off — that logging the submitted identifier alongside the found/not-found outcome could
  act as an enumeration oracle if log access isn't tightly restricted — was weighed during #49's
  planning and the decision was made to include it anyway.

## Solution

### Scope

This sub-issue covers only the two log points below, both within `PasswordResetService`'s
`recover` flow.

Explicitly **out of scope**:

- Any change to `/auth/recover.json`'s actual response behavior (it should keep responding
  identically regardless of whether the user was found, per its existing anti-enumeration design —
  only the *logging* changes here, never the HTTP response).
- The admin-tool routes (`AdminController`'s `recovery-link.json`/`send-recovery-email.json`) —
  those already take a `:id` directly (no email lookup / found-not-found ambiguity) and are out of
  scope for this sub-issue.
- Any other #49 logging point.

### What needs to be done

- Inject `LoggerService` into `PasswordResetService`'s constructor (following the pattern already
  used by `MailService` and `PasswordRecoveryRequestedListener`), tagging every call with
  `context: 'PasswordResetService'`.
- At the start of `recover()`, log at `info` level that a password-recovery request was received
  (matches this codebase's convention of using `info` — the default `KERGHAN_LOG_LEVEL` threshold —
  for volume/lifecycle events, reserving `debug` for lower-signal detail).
- After the `userRepository.findOneBy` lookup, log at `info` level whether a matching user was
  found, including the submitted `email` (the `RecoverDto` field) in both outcomes, plus `userId`
  when found, per the already-made decision above.
- Request correlation is automatic and needs no extra work here: `LoggerService` already merges the
  active request's `requestId` into every log line via `RequestContextService`, which
  `RequestContextMiddleware` binds globally for every route (`AppModule`, #49 sub-issue 2, already
  landed).
- Unit specs covering: a log line is produced for the request itself, and one for each of the
  found/not-found outcomes, asserting the submitted `email` appears in the found/not-found log
  line (and `userId` in the found case).

### Acceptance criteria

- [ ] `PasswordResetService#recover` logs that a password-recovery request was received, for every
      call.
- [ ] The same flow logs whether the submitted user was found or not, including the submitted
      email/username in that log line.
- [ ] `/auth/recover.json`'s HTTP response is unchanged by this sub-issue — identical for found and
      not-found cases, as it is today.
- [ ] Unit specs cover both the request-received log and both found/not-found outcomes.

## Benefits

- Gives operational visibility into password-recovery volume and hit rate without changing the
  endpoint's deliberately uniform response behavior.
