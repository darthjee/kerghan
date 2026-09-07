# Issue: Backend: sendEmailTemplate + filesystem email templates + renderTemplate helper

## Description

Split from #70 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #70 sub-issue 1, which has **landed**: `MailService.sendEmail`, the `EmailMethod`
registry (`MAIL_METHODS`), `mail.tokens.ts`, and the `KERGHAN_EMAIL_METHOD` default are all in
place.

This sub-issue adds `MailService.sendEmailTemplate(...)` and the **filesystem template** system
it renders: a named template supplies the subject and body, `{{variable}}` placeholders are
interpolated, and the rendered message is handed to the same internal send path `sendEmail`
uses. It ships the template machinery and a pure renderer with their own unit tests, touching no
feature code — the first real consumer (the password-recovery email) is #70 sub-issue 3.

## Problem

- **No templating.** Every caller must hand-compose `subject` + `body` (+ `html`). Kerghan's one
  transactional email does this through a bespoke pure helper
  (`backend/src/auth/events/password-recovery-email.content.ts`); the deferred welcome email
  would need its own. `docs/agents/modules/mail.md` explicitly states the module ships no
  templates.
- There is no shared place for email copy, no variable interpolation, and no
  "the template owns the subject" convention.
- `sendEmail`'s send path (method resolution, disabled-skip, header guards, `#deliver`, failure
  logging, `SendEmailResult`) currently lives inline in the public method — there is no shared
  private entry point a second public method could delegate to without duplicating it.

## Expected Behavior

### Template files

- Live under `backend/src/mail/templates/<name>/`, each directory holding:
  - `subject.txt` — the subject line (may contain `{{variable}}` placeholders);
  - `body.txt` — the plain-text body;
  - `body.html` — *optional* HTML body.
- Templates are discovered and registered at boot by a directory scan. A directory missing
  `subject.txt` or `body.txt` is a boot error naming the offending template.
- **An empty or absent `templates/` directory is not an error** — the scan yields a frozen empty
  registry. No production template ships in this issue (the real `password-recovery` template is
  #70 sub-issue 3); a committed `.gitkeep` keeps the directory present in git.

### Build / runtime resolution

- `.txt` / `.html` files are **not** TypeScript, so `nest build` must be told to copy them: add
  `mail/templates/**/*` to `nest-cli.json`'s `compilerOptions.assets` (with `watchAssets` so
  `nest start --watch` picks up edits). The compiled tree then has
  `dist/mail/templates/<name>/…` alongside `dist/mail/*.js`.
- The registry factory resolves its scan root relative to its own compiled location
  (`fileURLToPath(import.meta.url)` → sibling `templates/`), so it behaves identically under
  `nest start` (dev, against `src/`) and `node dist/main.js` (production) with no
  `process.cwd()` assumption.

### `renderTemplate`

- Pure helper: `renderTemplate(registry, templateName, variables): { subject: string; text:
  string; html?: string }`, its own file, unit-tested without booting the app (mirrors
  `buildMailConfig` / `buildJwtSignOptions`). The registry is **passed in** — the helper never
  touches `fs` or `process.env`.
- `{{variable}}` interpolation (whitespace inside the braces tolerated). A placeholder with no
  matching key in `variables` → **throw**, naming the template and the missing key. Extra keys
  in `variables` are ignored.
- In `body.html`, interpolated values are **HTML-escaped** (`& < > " '`); in `subject.txt` /
  `body.txt` they are inserted verbatim.
- An unknown `templateName` → throw (`mail: unknown template: <name>`).
- A template with no `body.html` → the result has no `html` key.

### `sendEmailTemplate`

```ts
interface SendEmailTemplateParams {
  to: string;
  template: string;
  variables: Record<string, string>;
  from?: string;
  method?: string;
}

sendEmailTemplate(params: SendEmailTemplateParams): Promise<SendEmailResult>;
```

- Resolves `method = params.method ?? config.method` and validates it against the registry
  (`mail: unknown method: <name>` — same as `sendEmail`, thrown even when disabled).
- **Disabled mail short-circuits before rendering**: `KERGHAN_EMAILS_ENABLED` not `'true'` →
  `{ status: 'skipped', method }`, the template is **not** resolved or interpolated, and a
  `debug` line is logged (recipient + `template` name + resolved method). Consequently an unknown
  template or a missing variable only rejects `sendEmailTemplate` **when mail is enabled**.
- **Enabled**: renders the template, then delegates to the **same** private send path as
  `sendEmail` — one `#deliver`, identical header guards, failure logging, and `SendEmailResult`.
- `from` / `method` passthrough identical to `sendEmail`.

### Shared send path

- Extract a private shared path from the current `sendEmail` body so both public methods reach
  delivery through **one** code path: header guards (`#assertSendable`), `#deliver`, and the
  failure-logging `try/catch` that produces `SendEmailResult`. `sendEmail`'s existing behaviour
  and specs are unchanged after the extraction.
- Method resolution/validation and the disabled-skip are shared too, but arranged so the
  template path can skip **before** rendering (per the rule above). The delivery half (guards →
  deliver → result) stays single, so plain and templated sends cannot drift there. The exact
  private decomposition (one `#send` vs. `#send` + a small resolve/skip helper) is a planning
  detail.

## Solution

### Scope

`backend/src/mail/templates/` (a `.gitkeep`-only directory) + boot-time registration, the pure
`renderTemplate` helper, the extracted shared send path, `MailService.sendEmailTemplate`, the
`nest-cli.json` assets entry, and the matching spec + doc changes.

**Explicitly out of scope**

- **Migrating `password-recovery-email.content.ts`** onto a template and repointing its callers —
  #70 sub-issue 3.
- **A template engine / layouts / partials / Markdown / conditionals / loops** — `{{variable}}`
  string interpolation only.
- **DB-stored or admin-editable templates**, i18n / per-locale variants.
- **Attachments, inline images, `cc`/`bcc`** — unchanged from #38's deferrals.
- **Shipping a real `templates/<name>/` directory** — none until sub-issue 3; only a spec
  fixture tree under `tests/`.

### What needs to be done

**`backend/src/mail/`**

- `render-template.ts` (new) — `renderTemplate(registry, templateName, variables)` + a small
  `interpolate(text, variables, { escapeHtml })` internal.
- `template-registry.ts` (new) — `buildTemplateRegistry(templatesDir)`: directory scan returning
  a frozen `Record<name, { subject: string; text: string; html?: string }>` (raw,
  pre-interpolation); a directory missing `subject.txt`/`body.txt` throws naming it; an
  absent/empty dir → `{}`.
- `mail.module.ts` — add a `MAIL_TEMPLATES` provider (new token in `mail.tokens.ts`) as a
  `useFactory` that calls `buildTemplateRegistry` with the dir resolved via `import.meta.url`;
  coverage-excluded as wiring, like the transport/methods factories.
- `mail.service.ts` — inject `MAIL_TEMPLATES`; extract the shared send path out of `sendEmail`;
  add `sendEmailTemplate`.
- `mail.tokens.ts` — add the `MAIL_TEMPLATES` token.
- `templates/.gitkeep` (new).

**`backend/nest-cli.json`**

- Add `compilerOptions.assets` with `mail/templates/**/*` and `watchAssets: true` so templates
  land in `dist/` on `nest build` and are re-copied on `nest start --watch`.

**Tests (`backend/src/mail/tests/`)**

- `render-template.spec.ts` (new) — interpolation into subject/text/html; `{{ spaced }}`
  tolerated; missing variable → throws naming template + key; extra keys ignored; HTML-escaping
  applied to `body.html` only; unknown template name → throws; template with no `html` → result
  has no `html` key.
- `template-registry.spec.ts` (new) — a fixture `templates/` tree under `tests/` (e.g.
  `tests/fixtures/templates/`): loads `subject`/`text`/optional `html`; a dir missing `body.txt`
  → throws; an empty/absent dir → `{}`.
- `mail.service.spec.ts` — add `sendEmailTemplate`: enabled → renders + calls the shared send
  path with the rendered `{ subject, text, html }`, `from`/`method` passthrough, result shape
  matches `sendEmail`; enabled + unknown template / missing variable → rejects; **disabled →
  `{ status: 'skipped', method }` with the template never rendered** (assert the renderer/registry
  is not consulted, and a bad template/variable does *not* reject on the disabled path); unknown
  method throws disabled or not. Existing `sendEmail` specs still pass unchanged after the
  extraction.

**Docs**

- `docs/agents/modules/mail.md` — replace the **"No templates"** section with a **Templates**
  section (location, `subject.txt`/`body.txt`/`body.html` layout, `nest-cli.json` asset copy +
  `import.meta.url` resolution, `{{variable}}`, missing-variable throw, HTML-escaping,
  empty-registry-is-fine, "the template owns the subject"); extend the **API** section with
  `sendEmailTemplate` / `SendEmailTemplateParams` and the disabled-skips-before-render rule; note
  the shared private send path.
- `docs/agents/architecture/backend.md` — add `templates/` to the `mail/` entry in the layout
  block; note the `nest-cli.json` `assets` copy in the build section.
- `docs/agents/folder-structure.md` — note `backend/src/mail/templates/` if it enumerates that
  deep.
- `docs/agents/summary.md` — update the Mail bullet ("…templated sends via `sendEmailTemplate`;
  filesystem templates under `mail/templates/`, read once at boot").

### Acceptance criteria

- [ ] `backend/src/mail/templates/<name>/` with `subject.txt`, `body.txt`, optional `body.html`
      is discovered and registered at boot; a directory missing a required file fails boot naming
      the template; an empty/absent `templates/` yields an empty registry (no error).
- [ ] `nest build` copies `mail/templates/**` into `dist/`, and the registry resolves its scan
      root via `import.meta.url` so it works under both `nest start` and `node dist/main.js`.
- [ ] `renderTemplate(registry, templateName, variables)` returns `{ subject, text, html? }` with
      `{{variable}}` interpolated; a missing variable throws naming the template + key; extra
      keys are ignored; values are HTML-escaped in `body.html` only; an unknown template name
      throws; no `body.html` → no `html` key.
- [ ] `sendEmail` and `sendEmailTemplate` reach delivery through one shared private path;
      `sendEmail`'s existing specs pass unchanged.
- [ ] `MailService.sendEmailTemplate({ to, template, variables, from?, method? })`: when enabled,
      renders then delegates to the shared send path (identical guards, logging,
      `SendEmailResult`); when disabled, returns `{ status: 'skipped', method }` **without
      rendering** — a bad template/variable does not reject on the disabled path; an unknown
      method throws disabled or not.
- [ ] `renderTemplate` and `template-registry` have unit specs that do not boot the app;
      `sendEmailTemplate` has service specs.
- [ ] `docs/agents/modules/mail.md` Templates + API sections, and the `architecture/backend.md`
      / `folder-structure.md` / `summary.md` references, reflect the new surface.
- [ ] `docker-compose run --rm kerghan_tests yarn coverage` and
      `docker-compose run --rm kerghan_tests yarn lint` pass.

## Benefits

- One shared place for transactional email copy, with variable interpolation and a
  template-owns-the-subject convention — no more per-feature string builders.
- The pure `renderTemplate` helper keeps rendering trivially testable and independent of the
  send path.
- Extracting the shared send path gives plain and templated sends one delivery path — same
  guards, logging, and result — so they cannot drift.
- Directly unblocks #70 sub-issue 3 (migrate the password-recovery email) and the deferred
  welcome email — each becomes "add a template + one `sendEmailTemplate` call".
