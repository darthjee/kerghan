# Convert HTML_ESCAPES to a Map

Replace the module-level `HTML_ESCAPES: Record<string, string>` object with a
module-level `Map<string, string>` holding the same five entries
(`&`, `<`, `>`, `"`, `'`). Update `escapeHtml` to look up each matched
character via `HTML_ESCAPES.get(char)` instead of `HTML_ESCAPES[char]`.
`HTML_ESCAPE_PATTERN` only ever matches one of those five characters, so
`.get(char)` is guaranteed to return a `string`, not `undefined` — no `??`
fallback or non-null assertion is needed if the return type is narrowed
appropriately (e.g. keep the replacer's return type as `string` and let
TypeScript's inference hold, or use `HTML_ESCAPES.get(char) as string` only
if the type doesn't narrow, with a comment explaining why it's safe given the
matching regex).

This removes the `security/detect-object-injection` finding at the current
`:32` and is expected to also resolve the `xss/no-mixed-html` finding at the
same line (see `backend.md`'s Notes for the fallback if it doesn't).

## Files to Change
- `backend/src/mail/render-template.ts` — `HTML_ESCAPES` becomes a `Map`; `escapeHtml` uses `.get()` instead of bracket access.
