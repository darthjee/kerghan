# backend Plan: Refactor: simplify escapeHtml() in render-template.ts to a single-pass replacement

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Replace the chained `.replace()` calls with a single-pass lookup

In `backend/src/mail/render-template.ts`, replace `escapeHtml()`'s five sequential
`.replace()` calls with a single regex match against a static
`Record<string, string>` entity map:

```ts
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const HTML_ESCAPE_PATTERN = /[&<>"']/g;

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPES[char]);
}
```

Update the function's JSDoc to describe the single-pass lookup instead of the
"escape `&` first" ordering rationale, since that rationale no longer applies. Keep the
function's name, signature, and exported surface unchanged — it's only called internally by
`interpolate()` in the same file.

`backend/src/mail/tests/render-template.spec.ts` already exercises escaping of `< > & " '`
together (`'<b>&"\''` in the "HTML-escapes values in html only" test), so behavior is
regression-covered by the existing suite — no new test case is required, but re-run the suite
to confirm output is byte-identical after the change.

## Files to Change

- `backend/src/mail/render-template.ts` — replace the chained-`.replace()` `escapeHtml()` with
  a single regex + lookup-table pass; update its JSDoc accordingly.

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- The original Codacy finding (71 lines vs. an 8-line actual function) does not reproduce; this
  refactor is a voluntary clarity improvement, not a complexity-limit fix. No change to the
  50-line limit or to Codacy config is in scope.
- Purely internal refactor — no public API, migration, or cross-module contract changes.
