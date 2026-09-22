# Convert variable interpolation to a Map

In `interpolate`, build a `Map<string, string>` from the `variables` parameter
(e.g. `new Map(Object.entries(variables))`) once at the top of the function,
and use it in place of the current `Object.prototype.hasOwnProperty.call` +
bracket-access pair:

- Replace `Object.prototype.hasOwnProperty.call(variables, key)` with
  `variablesMap.has(key)`.
- Replace `variables[key]` (both occurrences, escaped and unescaped) with
  `variablesMap.get(key)`. Since the `.has(key)` check already guards the
  branch that throws, the `.get(key)` on the surviving path is guaranteed to
  return a `string`; narrow accordingly (e.g. a local `const value = variablesMap.get(key) as string;` with a comment, since TypeScript's control-flow
  analysis can't link a `Map.has` check to a later `Map.get` the way it can
  for `in`/plain-object narrowing) rather than adding a redundant runtime
  fallback.

Keep the `variables: Record<string, string>` parameter type and the
`mail: template '<name>' is missing variable '<key>'` error message exactly
as they are — only the internal lookup mechanism changes.

This removes the `security/detect-object-injection` finding at the current
`:55`.

## Files to Change
- `backend/src/mail/render-template.ts` — `interpolate` builds and reads from a `Map` instead of bracket-accessing `variables` directly.
