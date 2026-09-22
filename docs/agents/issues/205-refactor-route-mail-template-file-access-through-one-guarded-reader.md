# Issue: Refactor: Route mail template file access through one guarded reader

## Description
`backend/src/mail/template-registry.ts` calls `existsSync`, `readFileSync`, and `readdirSync` with computed paths in eight places, one call site per use.

## Problem
Codacy flags `backend/src/mail/template-registry.ts` at lines 34, 38, 43, 44, 47, 48, 66 and 72 (`security/detect-non-literal-fs-filename`, High) and at lines 32, 47 and 48 (`xss/no-mixed-html`, High) — eleven findings in total. The paths are derived from a fixed templates directory and three fixed file names, but nothing in the code tells Codacy's analyzer so.

## Expected Behavior
Registry contents, error messages (`mail: template '<name>' is missing subject.txt`, `mail: template '<name>' is missing body.txt`), and freezing behavior are unchanged.

## Solution
Introduce one small internal function, e.g. `readTemplateFile(dir, file)`, where `file` is restricted by type to `'subject.txt' | 'body.txt' | 'body.html'` and the resolved path is asserted to stay inside `dir`, throwing if it doesn't. Route every read/exists check in `template-registry.ts` through it, and keep the directory listing (`readdirSync`) in a single place, so file-system calls sit at one reviewed call site instead of eight. Export `readTemplateFile` (or otherwise make it directly reachable from a spec) so a dedicated unit test can exercise the containment-check throw directly, since the literal-union `file` type makes that branch unreachable through the public `buildTemplateRegistry` API alone — this keeps coverage from dropping without an ignore comment. If Codacy still reports that call site, leave it and note it in the PR rather than layering workarounds.

## Benefits
Cuts eleven findings to at most one and makes the trust boundary for template paths explicit. After merge, Codacy's re-analysis of `main` should no longer report the findings listed under Problem, with `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` passing and coverage not reduced.
