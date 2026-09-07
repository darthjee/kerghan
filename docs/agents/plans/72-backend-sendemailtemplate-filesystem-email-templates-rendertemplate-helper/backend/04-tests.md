# Specs and fixtures

Two new spec files plus additions to `mail.service.spec.ts`, with on-disk fixtures for the
registry scan. Aim for full branch coverage of `template-registry.ts` and `render-template.ts`.

## `render-template.spec.ts` — new

Build a synthetic frozen registry inline (no `fs`):

```ts
const registry = Object.freeze({
  greet: Object.freeze({
    subject: 'Hello {{ name }}',
    text: 'Hi {{name}} — code {{code}}',
    html: '<p>Hi {{name}} &amp; co — {{code}}</p>',
  }),
  plain: Object.freeze({ subject: 'Static', text: 'no vars' }),
});
```

Cases:

- interpolates `name` into subject / text / html; `{{ name }}` (spaced) is honoured.
- values are inserted **verbatim** in `subject` and `text` — pass `name: '<b>&"\'' ` and assert
  the raw string survives in `subject`/`text`.
- values are **HTML-escaped** in `html` only — same `name` → `&lt;b&gt;&amp;&quot;&#39;` in the
  rendered `html`.
- missing variable → throws `mail: template 'greet' is missing variable 'code'` when
  `variables` has only `name`.
- extra keys ignored — `{ name, code, unused: 'x' }` renders fine.
- unknown template name → throws `mail: unknown template: nope`.
- `plain` (no `html`) → `'html' in result === false`.

## `template-registry.spec.ts` — new

Fixtures under `backend/src/mail/tests/fixtures/` (excluded from `tsconfig.build.json`, read via
`join(__dirname, 'fixtures', …)` — `__dirname` is available under `@swc/jest`'s CommonJS
transform):

- `fixtures/templates-ok/full/` → `subject.txt` = `Full {{x}}\n` (note trailing newline),
  `body.txt` = `Body {{x}}\n`, `body.html` = `<p>{{x}}</p>\n`
- `fixtures/templates-ok/text-only/` → `subject.txt`, `body.txt` (no `body.html`)
- `fixtures/templates-broken/broken/` → `subject.txt` only (no `body.txt`)
- `fixtures/templates-empty/.gitkeep` → empty directory (bare `.gitkeep` file)

Cases:

- `buildTemplateRegistry(templates-ok)` → keys `full`, `text-only`; `full.subject === 'Full {{x}}'`
  (single trailing newline stripped), `full.text === 'Body {{x}}\n'` (verbatim), `full.html`
  present; `'html' in registry['text-only'] === false`.
- content is raw / pre-interpolation (`{{x}}` still literally present).
- result and each entry are `Object.isFrozen(...)`.
- `buildTemplateRegistry(templates-broken)` → throws `mail: template 'broken' is missing body.txt`.
- `buildTemplateRegistry(templates-empty)` → `{}` (bare `.gitkeep`, no directories).
- `buildTemplateRegistry(join(__dirname, 'fixtures', 'does-not-exist'))` → `{}`.

## `mail.service.spec.ts` — additions

- Introduce a `makeService(config, methodsArg = methods, templatesArg = templates)` helper in
  the top `describe` scope and route the existing `new MailService(...)` call sites through it,
  so the new 4th constructor arg is added in one place. Add a shared
  `const templates = Object.freeze({ welcome: Object.freeze({ subject: 'Hi {{name}}', text:
  'Body {{name}} PLAIN_BODY_SECRET', html: '<p>{{name}} HTML_BODY_SECRET</p>' }) });`.
- Existing `sendEmail` expectations are otherwise unchanged.

New `describe('sendEmailTemplate')`:

- **enabled, renders + delegates:** `deliver.mockResolvedValue({ messageId: 'abc' })`,
  `sendEmailTemplate({ to, template: 'welcome', variables: { name: 'Sam' } })` → `deliver`
  called once with `{ from: 'no-reply@kerghan.local', to, subject: 'Hi Sam', text: 'Body Sam
  PLAIN_BODY_SECRET', html: '<p>Sam HTML_BODY_SECRET</p>' }`; result `{ status: 'sent', method:
  'native', messageId: 'abc' }`.
- **`from` override / per-call `method`** — mirror the existing `sendEmail` passthrough tests
  (reuse the `other: { deliver: otherDeliver }` pattern).
- **disabled skips before rendering:** `makeService(disabledConfig)` with a `templates` map
  whose `welcome` references `{{name}}` but call with `variables: {}` → resolves
  `{ status: 'skipped', method: 'native' }`, does **not** reject, `deliver` not called,
  `logger.debug` called with `expect.objectContaining({ context: 'MailService', to,
  template: 'welcome', method: 'native' })`.
- **enabled + unknown template** → rejects `mail: unknown template: nope`, `deliver` not called.
- **enabled + missing variable** → `sendEmailTemplate({ template: 'welcome', variables: {} })`
  rejects `mail: template 'welcome' is missing variable 'name'`, `deliver` not called.
- **unknown method** (both `enabledConfig` and `disabledConfig`) → rejects
  `mail: unknown method: carrier-pigeon` before render/deliver.
- **header-injection guard on the rendered subject:** `variables: { name: 'x\nBcc: e@e' }` →
  rejects `mail: header field contains a newline`, `deliver` not called.
- **bodies not leaked on failure:** `deliver.mockRejectedValue(new Error('boom'))` →
  `logger.error` attrs JSON contains neither `PLAIN_BODY_SECRET` nor `HTML_BODY_SECRET`.

## Files to Change

- `backend/src/mail/tests/render-template.spec.ts` — **new**.
- `backend/src/mail/tests/template-registry.spec.ts` — **new**.
- `backend/src/mail/tests/fixtures/templates-ok/full/{subject.txt,body.txt,body.html}` — **new**.
- `backend/src/mail/tests/fixtures/templates-ok/text-only/{subject.txt,body.txt}` — **new**.
- `backend/src/mail/tests/fixtures/templates-broken/broken/subject.txt` — **new**.
- `backend/src/mail/tests/fixtures/templates-empty/.gitkeep` — **new**, empty.
- `backend/src/mail/tests/mail.service.spec.ts` — `makeService` helper + `templates` map;
  `sendEmailTemplate` describe block.
