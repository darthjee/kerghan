# Issue: Refactor: simplify escapeHtml() in render-template.ts to a single-pass replacement

## Description
A Codacy `nloc-medium` finding reported that `escapeHtml()` in `backend/src/mail/render-template.ts` has 71 lines of code, exceeding the 50-line method limit. That claim does not reproduce against the current code: `escapeHtml()` (render-template.ts:22-29) is 8 lines, and git history shows it has never been larger since it was introduced in #72. Rather than close this outright, this issue is repurposed as a small voluntary clarity refactor of `escapeHtml()`.

## Problem
`escapeHtml()` chains five sequential `String.replace()` calls, one per special character (`& < > " '`). Correctness depends on an implicit ordering invariant — `&` must be replaced first, or the entities introduced by the later replacements (e.g. `&amp;`) would themselves get re-escaped. This ordering requirement is not enforced by the code and is not obvious to a future editor who reorders or adds a line.

## Expected Behavior
`escapeHtml()` continues to escape `& < > " '` to `&amp; &lt; &gt; &quot; &#39;` respectively, with identical output to the current implementation for every input, but does so in a single pass over the string via one regex and a lookup table, removing the ordering dependency.

## Solution
Replace the five chained `.replace()` calls with a single regex (e.g. `/[&<>"']/g`) matched against a static `Record<string, string>` entity map:

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

Keep existing unit tests under `backend/src/mail/` passing unchanged (they assert output, not implementation), and add a case covering a string containing all five special characters interleaved to confirm no double-escaping.

## Benefits
- Removes the implicit ordering dependency that made the function fragile to reorder.
- Single pass over the string instead of five.
- Easier to extend if more entities are ever needed — just add a map entry.
