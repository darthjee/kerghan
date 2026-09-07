# Add the EmailMethod seam and NativeEmailMethod

Create the `EmailMethod` interface and its only implementation, `NativeEmailMethod`, in a new
`mail.method.ts`. `EmailMethod` declares one async method, `deliver({ from, to, subject, text,
html })`, resolving to `{ messageId? }` or rejecting. `NativeEmailMethod` takes the injected
nodemailer `Transporter` in its constructor and implements `deliver` by calling
`transporter.sendMail(...)`, preserving the exact `accepted`/`rejected` handling currently inline
in `MailService.#deliver` (empty `accepted` + non-empty `rejected` → throws `mail: recipient
rejected: <addrs>`). `Transporter` is only reachable as non-null here — disabled mail is
short-circuited by `MailService.sendEmail` before any method is invoked (see step 04).

Add `mail.method.spec.ts` covering `NativeEmailMethod.deliver`: maps to
`transporter.sendMail` with the right args, resolves `{ messageId }` on success, and throws the
`recipient rejected` error when `info.rejected` is non-empty and `info.accepted` is empty (mirror
the existing coverage in `mail.service.spec.ts` for this behavior, since it moves here).

## Files to Change

- `backend/src/mail/mail.method.ts` (new) — `EmailMethod` interface + `NativeEmailMethod` class.
- `backend/src/mail/tests/mail.method.spec.ts` (new) — unit coverage for `NativeEmailMethod`.
