# Backend Plan: sendEmailTemplate + filesystem email templates + renderTemplate helper

Main plan: [plan.md](plan.md)

## Overview

The Mail module already has `MailService.sendEmail`, the `EmailMethod` registry (`MAIL_METHODS`),
`mail.tokens.ts`, and the `KERGHAN_EMAIL_METHOD` default (#70 sub-issue 1, landed). This plan
adds, entirely within `backend/src/mail/`:

- a boot-time **template registry** (`template-registry.ts` + a new `MAIL_TEMPLATES` provider),
  fed by a directory scan of `templates/<name>/`, with `nest-cli.json` taught to copy the
  non-TS template files into `dist/`;
- a pure **`renderTemplate`** helper (`render-template.ts`) doing `{{variable}}` interpolation
  with HTML-escaping in `body.html` only;
- **`MailService.sendEmailTemplate`**, which resolves + validates the method, short-circuits the
  disabled case **before rendering**, then renders and delegates to a private `#send(...)`
  extracted from `sendEmail` (one delivery path — guards, logging, `SendEmailResult`);
- the matching specs (two new files + `mail.service.spec.ts` additions + fixtures) and doc
  updates.

No production template ships here — the first real one (`password-recovery`) is #70 sub-issue 3.

## Context

- `mail.service.ts` currently keeps method resolution, the disabled-skip + `debug` log, header
  guards, `#deliver`, and failure logging inline in `sendEmail`; only `#deliver`,
  `#assertKnownMethod`, `#assertSendable`, `#hasNewline` are private methods.
- `mail.module.ts` is already coverage-excluded (`jest.config.ts` `collectCoverageFrom` has
  `!mail/mail.module.ts`); `useFactory` wiring lives there.
- Tests run under `@swc/jest` compiled to **CommonJS** (`jest.config.ts`) — `__dirname` is
  available in specs, `import.meta.url` is **not**. `import.meta.url` is safe only in
  `mail.module.ts`, which is real ESM at runtime and imported by no spec.
- Production runs `node dist/main.js`; `nest build` does **not** copy `.txt`/`.html` unless
  `nest-cli.json` `compilerOptions.assets` says so.
- House rules: `.js` extension on every relative import (NodeNext); full JSDoc (`@param` /
  `@returns`) on every exported function/interface (`eslint-plugin-jsdoc`); private class
  members ordered per `eslint-plugin-sort-class-members`; keep functions small
  (`eslint-plugin-complexity`).

## Steps

- [01 — Template registry + nest-cli assets + MAIL_TEMPLATES token](backend/01-template-registry.md)
- [02 — renderTemplate helper](backend/02-render-template.md)
- [03 — sendEmailTemplate + shared #send path + module wiring](backend/03-mail-service-send-template.md)
- [04 — Specs and fixtures](backend/04-tests.md)
- [05 — Documentation updates](backend/05-docs.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- **`import.meta.url` boundary.** Only `mail.module.ts` uses it (to resolve `TEMPLATES_DIR`
  relative to the compiled module). `template-registry.ts` takes the directory as a parameter
  and stays free of `import.meta` / `process.cwd()`; its spec uses `__dirname`.
- **Coverage.** `template-registry.ts` and `render-template.ts` are ordinary covered source —
  their specs must hit every branch (empty dir, absent dir, missing-file throw, no-`html`
  branch, escape vs. verbatim, missing-variable throw, unknown-template throw). Only the
  `MAIL_TEMPLATES` `useFactory` in `mail.module.ts` is wiring, and it is already covered by the
  existing `!mail/mail.module.ts` exclusion — no new exclusion needed.
- **Subject trailing newline.** `subject.txt` almost always ends with a newline from an editor;
  the registry strips a single trailing `\r?\n` from the subject so it never trips
  `#assertSendable`'s header-injection guard. Bodies are kept verbatim.
- **Small accepted duplication.** The disabled-skip + `debug` log appears in both `sendEmail`
  and `sendEmailTemplate` (differing only `subject` vs `template` in the log attrs); factor it
  through a `#skip(method, logAttrs)` helper so `sendEmail`'s existing spec assertions
  (`expect.objectContaining({ context, to, subject, method })`) still pass unchanged.
- **Out of scope:** migrating `password-recovery-email.content.ts` onto a template (#70
  sub-issue 3), any template engine beyond `{{variable}}`, a real `templates/<name>/` dir, and
  any new env var (`environment-variables.md` unchanged).
- **Low-risk to verify during implementation:** whether `nest build`'s asset glob warns when it
  matches only `.gitkeep` / nothing. `buildTemplateRegistry` tolerates an absent `dist/mail/templates`
  either way (`existsSync` guard → `{}`), so a silent skip is harmless.
