# Issue: Log the email-enabled flag check on every send attempt

## Description

Split from #49 (see that issue for the full design rationale). Depends on #49 sub-issue 1 (the
Core logger service, already landed). This sub-issue adds #49's logging point #3: logging the
outbound-mail enabled/disabled check on every send attempt, not just once at boot.

`MailModule`'s constructor already logs the enabled/disabled state once, at application startup
(`mail.module.ts`: `'outbound email disabled'` / `'outbound email enabled (host=...)'`). That
boot-time log stays as-is (already migrated onto the Core logger service). This sub-issue is about
the separate, per-send-attempt behavior below.

**Codebase check (2026-09-08): half of this is already implemented.** `MailService`'s private
`#skip()` helper — used by both `sendEmail` and `sendEmailTemplate` when `config.enabled` is
`false` — already logs `'email disabled; skipping send'` at `debug` level with
`{ context: 'MailService', to, subject, method }`, and has test coverage
(`mail.service.spec.ts`, `'when email is disabled'`). Only the **enabled** counterpart — logging
that the flag was checked and mail is proceeding to send — is missing. This issue's scope is
narrowed accordingly: see Solution.

## Problem

There's currently no visibility into whether an individual send attempt found outbound mail
enabled and proceeded, versus was skipped as disabled — only the disabled outcome is logged
per-attempt today; the enabled outcome is not. When diagnosing "why didn't this email go out" (or
confirming one legitimately did), the boot-time log alone doesn't say whether the flag was still
in effect at the moment of a specific attempt, and today only the skip path confirms that from the
per-attempt log.

## Expected Behavior

Every time `MailService` checks whether outbound mail is enabled before deciding to send (or skip)
a message, that check's outcome is logged at `debug` level (per #49's documented convention:
verbose/noisy logging stays silent by default in production, since `KERGHAN_LOG_LEVEL` defaults to
`info`) — for **both** outcomes, not just the disabled one.

## Solution

### Scope

This sub-issue covers only the missing **enabled-path** per-send-attempt debug log in
`MailService`. The disabled-path log (`#skip()`) already exists and is unchanged by this issue.

Explicitly **out of scope**:

- The existing one-time boot-time enabled/disabled log in `mail.module.ts` — already migrated onto
  the Core logger service, not touched here.
- The existing disabled-path debug log (`#skip()`) and its test — already implemented, not
  modified here.
- `MailService`'s send-outcome logging (success/failure via `#send()`'s `catch`) — already exists,
  not touched here.
- Any other #49 logging point.

### What needs to be done

- In `MailService`'s private `#send()` method (shared by both `sendEmail` and `sendEmailTemplate`,
  the single point reached once the enabled-check has passed — symmetric with where `#skip()`
  handles the disabled branch), add a `debug`-level log call via the already-injected
  `LoggerService`, confirming the flag was checked and mail is proceeding.
- Mirror `#skip()`'s shape: message `'email enabled; sending'` with attributes
  `{ context: 'MailService', to, subject, method }`.
- Unit spec (in `mail.service.spec.ts`, alongside the existing `'when email is disabled'` block)
  asserting this debug log fires for an enabled send attempt (both via `sendEmail` and
  `sendEmailTemplate`), and that it does not fire at `info` level or above.

### Acceptance criteria

- [ ] Every `MailService` send attempt logs, at `debug` level, that outbound mail was enabled and
      the send is proceeding — via the Core logger service, in `#send()`.
- [ ] Combined with the existing `#skip()` log, every send attempt now logs its enabled/disabled
      outcome, one way or the other.
- [ ] The new log line is silent at `info` level (Kerghan's default), confirmed by a unit spec.

## Benefits

Makes "was mail enabled when this specific send happened" answerable from logs alone for both
outcomes, without relying on remembering the boot-time state or correlating against a
deploy/restart timeline.
