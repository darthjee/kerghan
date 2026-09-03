# Unit tests

Two specs under `backend/src/mail/tests/`, in the codebase's `new`-the-class style (no
`Test.createTestingModule` for services — see `core/tests/cache-token.service.spec.ts`).

## `tests/mail.config.spec.ts` — covers `mail.config.ts`

`buildMailConfig` with a fake `configService` (`{ get: jest.fn() }` returning per-key values):

- `KERGHAN_EMAILS_ENABLED` unset / `"false"` / `"anything"` → `{ enabled: false, from: '',
  transport: null }`, frozen.
- `KERGHAN_EMAILS_ENABLED="true"` + `HOST` + `FROM` set → `enabled: true`, `from` echoed,
  `transport` non-null.
- enabled + `HOST` missing → throws, message names `KERGHAN_EMAIL_HOST`.
- enabled + `FROM` missing → throws, message names `KERGHAN_EMAIL_FROM`.
- enabled + `PORT` unset → `transport.port === 587`.
- enabled + `PORT="465"` → `transport.secure === true`, `transport.requireTLS` falsy.
- enabled + `PORT="587"`, `USE_TLS` unset → `transport.secure === false`,
  `transport.requireTLS === true`.
- enabled + `USE_TLS="false"` → `transport.requireTLS === false`.
- `USER` + `PASSWORD` both set → `transport.auth` present; only one set → `transport.auth`
  undefined.
- `TIMEOUT_MS` unset → the three timeout fields === `10000`; set → echoed.
- surrounding whitespace on `HOST` / `FROM` / `USER` is trimmed.

## `tests/mail.service.spec.ts` — covers `mail.service.ts`

`new MailService(fakeTransporter, mailConfig)` where
`fakeTransporter = { sendMail: jest.fn() }`:

- **enabled + success** (`sendMail` resolves `{ messageId: 'abc', accepted: ['x@y'],
  rejected: [] }`) → `sendMail` called once with `{ from, to, subject, text, html }`; returns
  `{ status: 'sent', messageId: 'abc' }`.
- **`from` default** — params without `from` → `sendMail` receives `config.from`; params with
  `from` → that value overrides.
- **disabled config** → `sendMail` not called; returns `{ status: 'skipped' }`; a `debug` line
  was logged (spy on `Logger.prototype.debug`).
- **`sendMail` rejects** → `send()` rejects with the same error; `Logger.prototype.error` was
  called; assert the error-log argument string contains neither the `text` nor the `html` value.
- **recipient rejected** (`sendMail` resolves `{ accepted: [], rejected: ['x@y'] }`) → `send()`
  rejects, message contains `x@y`.
- **empty `to`** (`''` or `'   '`) → rejects `"mail: 'to' is required"`; `sendMail` not called.
- **newline in `subject`** → rejects (header-injection guard); `sendMail` not called.

## Files to Change

- `backend/src/mail/tests/mail.config.spec.ts` — new
- `backend/src/mail/tests/mail.service.spec.ts` — new
