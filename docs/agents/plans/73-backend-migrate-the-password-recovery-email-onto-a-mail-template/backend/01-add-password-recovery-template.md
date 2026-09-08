# Add the `password-recovery` template

Create the first shipped mail template, porting the subject and body verbatim from
`password-recovery-email.content.ts`. Both files must be added together — the boot-time
`buildTemplateRegistry` scan fails if a template dir has one but not the other.

- `subject.txt` — exactly `Reset your Kerghan password` (a trailing newline is fine; the
  registry strips a single one).
- `body.txt` — the `BODY_PREFIX` + `\n{{resetUrl}}\n` + `BODY_SUFFIX` text from the helper,
  with `{{resetUrl}}` alone on its own line so mail clients linkify it. Preserve the em dash
  (`—`, U+2014) and the apostrophes. A single trailing newline is acceptable (the issue
  relaxed the byte-for-byte criterion). Full content:

  ```
  Hi,

  We received a request to reset the password for your Kerghan account.

  Open this link to choose a new password:
  {{resetUrl}}

  This link can only be used once, and it expires a short time after it was
  requested. If it has already expired, request a new one from the sign-in page.

  If you didn't ask to reset your password, you can safely ignore this email —
  your password won't change.
  ```

- No `body.html` — HTML body stays deferred.
- `{{resetUrl}}` is the only variable.
- The `backend/src/mail/templates/.gitkeep` placeholder may be deleted now that a real
  template directory exists (optional — leaving it is harmless).

## Files to Change

- `backend/src/mail/templates/password-recovery/subject.txt` — new; `Reset your Kerghan password`.
- `backend/src/mail/templates/password-recovery/body.txt` — new; the plain-text body above with
  the `{{resetUrl}}` placeholder on its own line.
- `backend/src/mail/templates/.gitkeep` — optionally delete (the directory is no longer empty).
