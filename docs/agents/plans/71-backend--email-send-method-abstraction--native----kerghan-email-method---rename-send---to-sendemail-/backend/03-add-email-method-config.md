# Add KERGHAN_EMAIL_METHOD to MailConfig

Add `method: string` to the `MailConfig` interface in `mail.config.ts`. In `buildMailConfig`,
read `KERGHAN_EMAIL_METHOD` trimmed (default `'native'` when unset/blank) on **both** the
enabled and disabled paths, and validate it against the shared known-method-names list (from step
02) regardless of which path is taken — an unknown value throws, naming it, using the same
"missing/invalid" error shape the enabled-but-misconfigured path already produces (extend
`collectInvalid`/the throw message rather than adding a second error format). The disabled
early-return (`DISABLED_MAIL_CONFIG`) needs its `method` field added too — it can no longer be a
single frozen constant object if `method` varies with the resolved+validated value; adjust the
disabled-path construction accordingly while still short-circuiting before any of the
enabled-only var reads.

Update `mail.config.spec.ts`: `KERGHAN_EMAIL_METHOD` unset → resolves to `native` (enabled and
disabled); explicit `'native'` → `native`; an unknown value → throws listing it (enabled and
disabled paths both covered).

## Files to Change

- `backend/src/mail/mail.config.ts` — `method` field, env read/default/validation, disabled-path
  handling.
- `backend/src/mail/tests/mail.config.spec.ts` — new cases for `KERGHAN_EMAIL_METHOD` resolution
  and validation.
