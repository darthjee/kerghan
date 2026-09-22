# Backend Plan: Refactor: Route mail template file access through one guarded reader

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Introduce `readTemplateFile(dir, file)` and route every call through it

In `backend/src/mail/template-registry.ts`, add an internal (non-exported from the module's
public surface, but reachable by the spec — see Step 2) function:

```ts
type TemplateFileName = 'subject.txt' | 'body.txt' | 'body.html';

function readTemplateFile(dir: string, file: TemplateFileName): string | undefined {
  const path = join(dir, file);

  if (!path.startsWith(join(dir, '.'))) {
    throw new Error(`mail: resolved template path escapes '${dir}'`);
  }

  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}
```

(Exact signature/return shape is a judgment call — e.g. it could instead return a
`{ exists, content }` pair or take an `optional: boolean` flag — as long as it is the single
place that calls `existsSync`/`readFileSync` with a computed path, and it still lets
`readTemplateDir` throw its existing `missing subject.txt`/`missing body.txt` errors when the
required files are absent.)

Rewrite `readTemplateDir` to call `readTemplateFile(dir, 'subject.txt')`,
`readTemplateFile(dir, 'body.txt')`, and `readTemplateFile(dir, 'body.html')` instead of its own
`existsSync`/`readFileSync` pairs, throwing the same two `mail: template '<name>' is missing
...` errors when the required results come back `undefined`. Keep `readdirSync` in
`buildTemplateRegistry` as the one remaining directory-listing call — it already lists a single
fixed root (`templatesDir`), so it doesn't need to route through the new helper.

Registry contents, the two "missing file" error messages, the html-optional behavior, and
`Object.freeze` calls must all stay exactly as they are today — this is a pure internal
refactor, not a behavior change.

### Step 2 — Cover the path-containment throw directly

`file`'s literal-union type means every call in this file already only ever passes one of the
three known names, so the containment check in `readTemplateFile` can never actually fail
through the public `buildTemplateRegistry` API — add a dedicated unit test in
`backend/src/mail/tests/template-registry.spec.ts` that reaches `readTemplateFile` directly
(export it from `template-registry.ts`, or otherwise make it reachable from the spec — whichever
reads cleanest) and asserts it throws when given a `dir`/`file` combination that would resolve
outside `dir`. This keeps coverage from dropping without resorting to an `istanbul`/`c8` ignore
comment.

Re-run the existing spec (`buildTemplateRegistry` describe blocks) unchanged — they exercise
`readTemplateFile`'s normal paths (present/absent files, missing subject/body) and should keep
passing without modification, confirming Step 1 preserved behavior.

## Files to Change

- `backend/src/mail/template-registry.ts` — add `readTemplateFile(dir, file)` with the
  literal-union `file` type and path-containment check; route `readTemplateDir`'s existing
  `existsSync`/`readFileSync` pairs through it.
- `backend/src/mail/tests/template-registry.spec.ts` — add a direct unit test of
  `readTemplateFile`'s containment-check throw; leave existing `buildTemplateRegistry` tests
  as regression coverage for unchanged behavior.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes

- If Codacy's re-analysis still flags the single `readTemplateFile` call site after this change,
  leave it as-is and note that in the PR description rather than adding further workarounds —
  per the issue's explicit fallback.
- Codacy's cited line numbers (34, 38, 43, 44, 47, 48, 66, 72 / 32, 47, 48) are a point-in-time
  snapshot and will not line up 1:1 with the refactored file; what matters is that the eight
  `fs` calls end up behind the one helper.
