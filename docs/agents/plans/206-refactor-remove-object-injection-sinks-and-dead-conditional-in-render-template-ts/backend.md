# Backend Plan: Refactor: Remove object-injection sinks and dead conditional in render-template.ts

Main plan: [plan.md](plan.md)

## Steps

- [01 — Convert HTML_ESCAPES to a Map](backend/01-html-escapes-map.md)
- [02 — Convert variable interpolation to a Map](backend/02-variables-map.md)
- [03 — Convert registry lookup to a Map and fix the dead conditional](backend/03-registry-map.md)

## Files to Change
- `backend/src/mail/render-template.ts` — all three bracket-access sinks replaced with `Map` lookups; the dead `if (!raw)` conditional replaced with one that a `Map.get` result actually allows to be falsy.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- `backend/src/mail/template-registry.ts` is out of scope — owned by the already-merged issue #205 (guarded file reader). `TemplateRegistry`'s exported type (`Readonly<Record<string, RawTemplate>>`) must not change; only how `render-template.ts` reads from it changes.
- `security/detect-object-injection` and `no-unnecessary-condition` are local, syntactic/type-driven checks that the `Map` conversion directly resolves. `xss/no-mixed-html` (Codacy-only, not in the local ESLint config — see `docs/agents/architecture/infra.md`'s `.codacy.yml` section) is a heuristic that also fires on dynamic bracket access into HTML-producing code; removing the bracket-access pattern is expected to resolve it too, but this can only be confirmed after Codacy's next re-analysis of `main`. If it still reports after this change, follow the repo's established precedent: a narrowly-scoped, inline `// eslint-disable-next-line xss/no-mixed-html` (documented with why) rather than further structural changes, and note this in the PR.
- No test changes are expected to be required — the existing spec (`backend/src/mail/tests/render-template.spec.ts`) already exercises the missing-variable throw, the unknown-template throw, and HTML escaping, which cover the new `Map`-based branches. Run `yarn coverage` to confirm no drop.
