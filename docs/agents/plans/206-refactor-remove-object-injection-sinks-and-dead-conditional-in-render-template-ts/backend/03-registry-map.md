# Convert registry lookup to a Map and fix the dead conditional

In `renderTemplate`, build a `Map<string, RawTemplate>` from `registry` (e.g.
`new Map(Object.entries(registry))`) and look the template up via
`.get(templateName)` instead of `registry[templateName]`. Do not change
`TemplateRegistry`'s exported type in `template-registry.ts` — only accept it
as today and adapt it locally to a `Map` for the lookup.

Because `Map.get` returns `RawTemplate | undefined` (unlike indexing a
`Record<string, RawTemplate>`, which TypeScript treats as always-present),
the existing `if (!raw) { throw ... }` now tests a value the type actually
allows to be absent — resolving the `no-unnecessary-condition` finding at the
current `:81` without weakening or removing the check. Keep the exact
`mail: unknown template: <name>` error message.

This removes the `security/detect-object-injection` finding at the current
`:79`.

## Files to Change
- `backend/src/mail/render-template.ts` — `renderTemplate` builds a `Map` from `registry` and looks up `templateName` through it; the `if (!raw)` guard is now meaningful given the `Map`'s return type.
