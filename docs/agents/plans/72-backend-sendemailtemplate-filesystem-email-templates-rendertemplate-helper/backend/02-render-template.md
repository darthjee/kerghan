# renderTemplate helper

A pure renderer that takes the raw registry, a template name, and a variables map, and returns
the interpolated `{ subject, text, html? }`. No `fs`, no env — the registry is passed in, so it
is unit-testable without booting the app (mirrors `buildMailConfig` / `buildJwtSignOptions`).

## What to build

### `render-template.ts` — new file

- Exports:
  - `interface RenderedTemplate { subject: string; text: string; html?: string }`
  - `function renderTemplate(registry: TemplateRegistry, templateName: string, variables: Record<string, string>): RenderedTemplate`
- Behaviour:
  - `registry[templateName]` missing → `throw new Error("mail: unknown template: <name>")`.
  - `subject` and `text` are interpolated **verbatim** (no escaping).
  - `html` is interpolated with **HTML-escaping** applied to each substituted value, and is
    included in the result **only** when the raw template has an `html` key (so a template with
    no `body.html` → `'html' in result === false`).
- Interpolation (internal `interpolate(text, variables, { escapeHtml }, templateName)`):
  - Placeholder regex `/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g` — whitespace inside the braces
    tolerated.
  - For each match, if `variables` has no own key for that name →
    `throw new Error("mail: template '<name>' is missing variable '<key>'")`.
  - Extra keys in `variables` are ignored (only referenced placeholders are looked up).
  - When `escapeHtml` is true, replace `&` `<` `>` `"` `'` with `&amp; &lt; &gt; &quot; &#39;`
    (escape `&` first). Keep this as a tiny separate `escapeHtml(value)` function.
- Full JSDoc on `renderTemplate` and `RenderedTemplate`. `.js` import extension on the
  `TemplateRegistry` type import from `./template-registry.js`.

## Files to Change

- `backend/src/mail/render-template.ts` — **new**: `renderTemplate`, `RenderedTemplate`,
  internal `interpolate` + `escapeHtml`.
