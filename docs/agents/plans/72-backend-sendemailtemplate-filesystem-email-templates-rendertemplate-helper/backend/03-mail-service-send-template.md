# sendEmailTemplate + shared #send path + module wiring

Wire the registry into `MailService`, extract the delivery half of `sendEmail` into a private
`#send`, and add `sendEmailTemplate` — rendering after the disabled-skip so a bad
template/variable only rejects when mail is enabled.

## `mail.module.ts` — provide the registry

- `import { fileURLToPath } from 'node:url';` and `import { dirname, join } from 'node:path';`
- `import { buildTemplateRegistry, type TemplateRegistry } from './template-registry.js';`
- Add `MAIL_TEMPLATES` to the `mail.tokens.js` import and to the `export { … }` re-export line.
- Module-level: `const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'templates');`
  — resolves to `dist/mail/templates` at runtime, `src/mail/templates` under `nest start`.
- Add a provider (no `inject`):
  ```ts
  {
    provide: MAIL_TEMPLATES,
    useFactory: (): TemplateRegistry => buildTemplateRegistry(TEMPLATES_DIR),
  },
  ```
- `mail.module.ts` stays in `jest.config.ts`'s `collectCoverageFrom` exclusion list — no change
  there.

## `mail.service.ts` — inject registry, extract `#send`, add `sendEmailTemplate`

### Imports

- `import { renderTemplate } from './render-template.js';`
- `import type { TemplateRegistry } from './template-registry.js';`
- Add `MAIL_TEMPLATES` to the `./mail.tokens.js` import.

### New exported type

```ts
/**
 * Arguments accepted by {@link MailService.sendEmailTemplate}. The named
 * template supplies the subject and body; `variables` are interpolated into
 * `{{placeholder}}` slots. `from` / `method` behave exactly as in
 * {@link SendEmailParams}.
 */
export interface SendEmailTemplateParams {
  to: string;
  template: string;
  variables: Record<string, string>;
  from?: string;
  method?: string;
}
```

### Constructor

Add `@Inject(MAIL_TEMPLATES) templates: TemplateRegistry` after `methods`, store as
`this.templates` (declare `private readonly templates: TemplateRegistry`). Keep member ordering
compatible with `eslint-plugin-sort-class-members`.

### Refactor `sendEmail` + add `#send` + `#skip`

- Extract a private `#skip(method, logAttrs)` that emits the existing
  `logger.debug('email disabled; skipping send', { context: 'MailService', method, ...logAttrs })`
  line and returns `{ status: 'skipped', method }`.
- Extract a private `#send(params: SendEmailParams, method: string): Promise<SendEmailResult>`
  holding today's post-disabled logic: `from = params.from ?? this.config.from` →
  `#assertSendable(params, from)` → `try { return await this.#deliver(params, from, method); }
  catch { logger.error('mail send failed', { context, to, subject, method, reason }); throw err; }`.
  `#deliver`, `#assertKnownMethod`, `#assertSendable`, `#hasNewline` are unchanged.
- `sendEmail` becomes:
  ```ts
  const method = params.method ?? this.config.method;
  this.#assertKnownMethod(method);
  if (!this.config.enabled) {
    return this.#skip(method, { to: params.to, subject: params.subject });
  }
  return this.#send(params, method);
  ```
  Observable order is identical to today, so the existing `sendEmail` specs pass unchanged
  (the disabled spec asserts `expect.objectContaining({ context, to, subject, method })`).

### `sendEmailTemplate`

```ts
async sendEmailTemplate(params: SendEmailTemplateParams): Promise<SendEmailResult> {
  const method = params.method ?? this.config.method;
  this.#assertKnownMethod(method);

  if (!this.config.enabled) {
    return this.#skip(method, { to: params.to, template: params.template });
  }

  const { subject, text, html } = renderTemplate(this.templates, params.template, params.variables);
  return this.#send(
    { to: params.to, subject, body: text, html, from: params.from, method: params.method },
    method,
  );
}
```

- Unknown method → throws `mail: unknown method: <name>` before rendering, disabled or not.
- Disabled → `{ status: 'skipped', method }`, template **not** rendered; the `debug` line
  carries `template` (name) instead of `subject`.
- Enabled → `renderTemplate` throws `mail: unknown template: …` / `mail: template '…' is
  missing variable '…'` (rejecting the promise); otherwise `#send` runs the same guards
  (header-injection check now applies to the **rendered** subject), logging, and
  `SendEmailResult` as `sendEmail`.
- Full JSDoc on `sendEmailTemplate` matching the house `@param` / `@returns` / `@throws` style.

## Files to Change

- `backend/src/mail/mail.module.ts` — `MAIL_TEMPLATES` provider + `TEMPLATES_DIR` via
  `import.meta.url`; extend the tokens import + re-export.
- `backend/src/mail/mail.service.ts` — inject `MAIL_TEMPLATES`; add `SendEmailTemplateParams`;
  extract `#skip` and `#send`; add `sendEmailTemplate`.
