# Update and remove the affected specs

Delete the helper's spec and repoint the two unit specs onto the `sendEmailTemplate` mail
double. Keep every existing outcome assertion (`sent` / `skipped` / rejection, non-leaking
logs).

## Delete

- `backend/src/auth/tests/password-recovery-email.content.spec.ts` — its subject/body coverage
  moves to the mail-template spec in step 04.

## `password-recovery-requested.listener.spec.ts`

- Rename the `sendEmail` mock to `sendEmailTemplate`; build the listener with
  `{ sendEmailTemplate } as unknown as MailService`.
- Success case — assert the call shape:
  ```ts
  expect(sendEmailTemplate).toHaveBeenCalledTimes(1);
  expect(sendEmailTemplate).toHaveBeenCalledWith({
    to: 'darthjee@example.com',
    template: 'password-recovery',
    variables: { resetUrl: event.resetUrl },
  });
  ```
- The "passes no from or html key" test becomes "passes no `from` or `method` key" — assert the
  single call arg has no `from` and no `method` property.
- Keep the disabled (`{ status: 'skipped' }` → resolves, no logging), transport-failure
  (`warn` once with `userId` + `reason`), recipient-rejected, and "never logs the token or the
  body copy" tests — the last still asserts the serialized `warn` args contain neither
  `plain-token-SECRET` nor `can only be used once`.
- Keep the `debug`-on-`sent` assertion (`messageId: 'mid-1'`, `userId: 1`).

## `admin.service.spec.ts`

- Change the mail double to `mailService = { sendEmailTemplate: jest.fn() }` and the
  constructor cast accordingly.
- `sendRecoveryEmail` success assertion:
  ```ts
  expect(mailService.sendEmailTemplate).toHaveBeenCalledWith({
    to: <user.email>,
    template: 'password-recovery',
    variables: {
      resetUrl: expect.stringContaining(
        'http://localhost:3000/#/recover-password?token=plaintext-token',
      ),
    },
  });
  ```
- Keep the outcomes: `mockResolvedValue({ status: 'sent', messageId: 'abc' })` → `{ sent: true }`,
  `{ status: 'skipped' }` → `{ sent: false }`, `mockRejectedValue(new Error('smtp exploded'))`
  → `{ sent: false }`, and the `NotFoundException` path.

## `admin.controller.e2e-spec.ts`

- Confirm no change is needed: it only asserts `response.body` equals
  `{ sent: expect.any(Boolean) }` and never inspects the `MailService` call shape. With mail
  disabled in the e2e app, `sendEmailTemplate` skips before rendering. Only touch this file if
  a `MailService`-call-shape assertion is actually present.

## Files to Change

- `backend/src/auth/tests/password-recovery-email.content.spec.ts` — delete.
- `backend/src/auth/tests/password-recovery-requested.listener.spec.ts` — repoint to
  `sendEmailTemplate`, assert the `{ to, template, variables: { resetUrl } }` shape, keep all
  outcome/log assertions.
- `backend/src/auth/tests/admin.service.spec.ts` — repoint the `sendRecoveryEmail` mail double
  and assertions to `sendEmailTemplate`, keep the `sent`/`skipped`/throwing outcomes.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — only if it inspects the `MailService`
  call shape (it currently does not).
