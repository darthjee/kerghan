## Description

Split from #70 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #70 sub-issue 2 (`sendEmailTemplate` + the filesystem template system).

The password-recovery email is currently composed by a bespoke pure helper,
`backend/src/auth/events/password-recovery-email.content.ts`
(`buildPasswordRecoveryEmail(resetUrl) → { subject, text }`), and sent via `MailService`. This
sub-issue makes it the **first consumer of the template system**: the subject and body move into
a `password-recovery` template, the helper is deleted, and both call sites switch to
`sendEmailTemplate`.

Observable behaviour is unchanged — same subject, same body text, same best-effort delivery in
the listener, same synchronous `sent`/`skipped` result on the admin path.

## Problem

- With the template system in place (#70 sub-issue 2), `password-recovery-email.content.ts` is
  now a one-off that duplicates what a template does — a bespoke builder, its own spec, and a
  `{ subject, text }` shape that predates `renderTemplate`.
- #70's goal ("transactional copy moves off ad-hoc string builders") is not met until the one
  existing consumer is migrated; the template system otherwise has no real user.

## Expected Behavior

### The `password-recovery` template

- `backend/src/mail/templates/password-recovery/subject.txt` — `Reset your Kerghan password`
  (verbatim from `SUBJECT` in `password-recovery-email.content.ts`).
- `backend/src/mail/templates/password-recovery/body.txt` — the current
  `BODY_PREFIX` + `\n{{resetUrl}}\n` + `BODY_SUFFIX` text, with `{{resetUrl}}` on its own line
  so mail clients linkify it. The copy, subject, and line layout are a verbatim move; a single
  trailing newline on `body.txt` is acceptable (`renderTemplate` reads `body.txt` verbatim and,
  unlike `subject.txt`, does not strip it) — the rendered body may differ from
  `buildPasswordRecoveryEmail`'s output by that one trailing `\n` and nothing else.
- No `body.html` (HTML body stays deferred, as today).
- `{{resetUrl}}` is the only variable.

### Callers

- `backend/src/auth/events/password-recovery-requested.listener.ts` —
  `mailService.sendEmailTemplate({ to: event.email, template: 'password-recovery', variables: {
  resetUrl: event.resetUrl } })`. The `try/catch`, the `skipped`-is-normal handling, the
  `debug` on `sent` / `warn` on failure (userId + reason only, never the address/token/url/body)
  are all unchanged.
- `AdminService.sendRecoveryEmail` — same `sendEmailTemplate` call; still `await`ed
  synchronously so the admin route returns a real `sent: true/false` (`false` covers both
  disabled mail and a thrown send error, never a `500`).

### Removed

- `backend/src/auth/events/password-recovery-email.content.ts` and
  `backend/src/auth/tests/password-recovery-email.content.spec.ts` are deleted.

## Solution

### Scope

Add the `password-recovery` template, repoint the listener and `AdminService.sendRecoveryEmail`
onto `sendEmailTemplate`, delete the bespoke helper + its spec, update the affected specs and
the auth + mail module docs.

**Explicitly out of scope**

- **An HTML body** for the recovery email — still deferred.
- **Changing the copy, subject, or the `resetUrl` format** — a verbatim move.
- **The welcome email on `user.registered`** — #70 only makes it easy later; not this issue.
- **Any `MailService` / template-system change** — that all landed in #70 sub-issues 1 and 2.

### What needs to be done

**`backend/src/mail/templates/password-recovery/`**

- `subject.txt`, `body.txt` — ported verbatim from `password-recovery-email.content.ts`.

**`backend/src/auth/`**

- `events/password-recovery-requested.listener.ts` — drop the `buildPasswordRecoveryEmail`
  import + call; use `sendEmailTemplate({ to, template: 'password-recovery', variables: {
  resetUrl } })`.
- `admin.service.ts` — same swap in `sendRecoveryEmail`.
- Delete `events/password-recovery-email.content.ts`.

**Tests**

- Delete `tests/password-recovery-email.content.spec.ts`.
- `tests/password-recovery-requested.listener.spec.ts` — update the mail double to
  `sendEmailTemplate`; assert it is called with `{ to: <event.email>, template:
  'password-recovery', variables: { resetUrl: <event.resetUrl> } }`; keep the `skipped` /
  `sent` / rejection assertions (including "token, resetUrl, body not in the log args").
- `tests/admin.service.spec.ts` — update the `sendRecoveryEmail` mail double + assertions to
  `sendEmailTemplate`; keep the `sent` / `skipped` / throwing-send outcomes.
- `tests/admin.controller.e2e-spec.ts` — update any assertion that inspects the `MailService`
  call shape.
- Add coverage for the real `password-recovery` template — implementer's choice between a new
  spec under `backend/src/mail/tests/` and extending `render-template.spec.ts`. Assert it
  renders with `{ resetUrl }` and that its `text` contains the resetUrl on its own line + the
  single-use/expiry and "didn't request this" sentences — the coverage the deleted
  `content.spec.ts` used to provide. Do **not** assert byte-for-byte equality with the old
  helper or the absence of a trailing newline.

**Docs**

- `docs/agents/modules/auth.md` — the `## password-recovery.requested event` section: the
  listener now builds the message via the `password-recovery` mail template and
  `MailService.sendEmailTemplate` (not `password-recovery-email.content.ts`).
- `docs/agents/modules/mail.md` — add a **Templates** section (it has none yet): list
  `password-recovery` as the first template, its single variable (`{{resetUrl}}`), the fact
  that it has no `body.html`, and its two consumers (the `password-recovery.requested` listener
  and `AdminService.sendRecoveryEmail`).

### Acceptance criteria

- [ ] `backend/src/mail/templates/password-recovery/` holds `subject.txt` + `body.txt` ported
      verbatim; `{{resetUrl}}` is the only variable; no `body.html`.
- [ ] `password-recovery-requested.listener.ts` and `AdminService.sendRecoveryEmail` send via
      `sendEmailTemplate({ template: 'password-recovery', variables: { resetUrl } })`; the
      listener stays best-effort and the admin path keeps its synchronous `sent`/`skipped`
      result.
- [ ] `password-recovery-email.content.ts` and its spec are deleted; the recovery email's
      subject/body assertions live in a mail-template spec instead.
- [ ] The rendered recovery email has the same visible content — copy, subject, and the
      `{{resetUrl}}` line — as `buildPasswordRecoveryEmail` produced for the same `resetUrl`. A
      single trailing newline on `body.txt` (which `renderTemplate` does not strip) is the only
      permitted difference.
- [ ] `docs/agents/modules/auth.md` references the template, and `docs/agents/modules/mail.md`
      gains a Templates section listing `password-recovery`.
- [ ] `docker-compose run --rm kerghan_tests yarn coverage` and
      `docker-compose run --rm kerghan_tests yarn lint` pass.

## Benefits

- Makes #70's goal concrete: the one existing transactional email is off its bespoke builder and
  on the shared template system, which now has a real consumer.
- Deletes code (`password-recovery-email.content.ts` + spec) in favour of two data files and a
  one-line call.
- Establishes the exact pattern the deferred welcome email and any future notification/digest
  mail will copy: add a `templates/<name>/` directory, call `sendEmailTemplate`.
