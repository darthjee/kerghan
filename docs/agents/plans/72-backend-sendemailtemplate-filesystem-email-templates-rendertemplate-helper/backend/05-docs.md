# Documentation updates

Reflect the new surface in the module doc and the architecture references.

## `docs/agents/modules/mail.md`

- **API section** — add:
  - `MailService.sendEmailTemplate(params: SendEmailTemplateParams): Promise<SendEmailResult>`
  - `SendEmailTemplateParams` — `{ to, template, variables, from?, method? }`; `from` / `method`
    behave as in `SendEmailParams`.
  - It shares `sendEmail`'s send path — same method resolution, header guards (applied to the
    **rendered** subject), failure logging, and `SendEmailResult`.
  - **Disabled** → `{ status: 'skipped', method }` **without rendering the template**;
    consequently an unknown template or a missing variable only rejects when mail is **enabled**.
    An unknown `method` still throws disabled or not.
- **Replace the "No templates" section with "Templates":**
  - Location: `backend/src/mail/templates/<name>/` — `subject.txt` (required), `body.txt`
    (required), `body.html` (optional).
  - Discovered by a boot-time directory scan (`template-registry.ts` `buildTemplateRegistry`),
    provided as `MAIL_TEMPLATES` from `mail.module.ts`, which resolves the directory relative to
    its own compiled location (`import.meta.url`). `nest-cli.json`'s `compilerOptions.assets`
    copies `mail/templates/**` into `dist/` so the scan works under `node dist/main.js` too.
  - A template directory missing `subject.txt` or `body.txt` **fails boot**, naming the missing
    file. An empty or absent `templates/` directory is **not** an error (empty registry) — no
    production template ships yet; a `.gitkeep` holds the directory. The subject's trailing
    newline is stripped so it never trips the header-injection guard.
  - Rendering: `renderTemplate(registry, name, variables)` (pure, `render-template.ts`) →
    `{ subject, text, html? }`. `{{variable}}` placeholders (whitespace inside braces tolerated)
    are interpolated; a placeholder with no matching key **throws**, naming the template + key;
    extra keys are ignored. Values are HTML-escaped (`& < > " '`) in `body.html` **only**;
    inserted verbatim in `subject.txt` / `body.txt`. The template owns the subject.
- **Logging section** — note that for `sendEmailTemplate` the disabled `debug` line carries the
  `template` name in place of `subject`.
- **Testing section** — add `mail/tests/render-template.spec.ts` and
  `mail/tests/template-registry.spec.ts` (with a `tests/fixtures/` template tree), and the
  `sendEmailTemplate` cases in `mail.service.spec.ts`.

## `docs/agents/architecture/backend.md`

- **Layout block**, `mail/` entry — add `mail.method.ts` (currently missing), `render-template.ts`,
  `template-registry.ts`, and a `templates/` line.
- **Build section** — add a sentence: `nest-cli.json`'s `compilerOptions.assets` copies non-TS
  files under `mail/templates/**` into `dist/`, and the mail template registry resolves that
  directory via `import.meta.url` so it works from `dist/mail/` as well as `src/mail/`.

## `docs/agents/folder-structure.md`

- The `src/mail/` row (line ~34) — append a short note that templates live under
  `mail/templates/`.

## `docs/agents/summary.md`

- The **Mail** bullet — after "disabled by default (log-and-skip)." add: "Templated sends via
  `sendEmailTemplate`, backed by filesystem templates under `mail/templates/` read once at boot."

## Files to Change

- `docs/agents/modules/mail.md` — API + Templates (replacing "No templates") + Logging +
  Testing.
- `docs/agents/architecture/backend.md` — layout block `mail/` entry + Build section.
- `docs/agents/folder-structure.md` — `src/mail/` row note.
- `docs/agents/summary.md` — Mail bullet.
