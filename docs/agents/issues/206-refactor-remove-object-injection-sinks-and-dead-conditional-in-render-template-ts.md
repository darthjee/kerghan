# Issue: Refactor: Remove object-injection sinks and dead conditional in render-template.ts

## Description
`render-template.ts` indexes plain objects with variable keys and carries an always-falsy conditional.

## Problem
In `backend/src/mail/render-template.ts`:

- `security/detect-object-injection` (High) at `:32` (`HTML_ESCAPES[char]`), `:55` (`variables[key]`) and `:79` (`registry[templateName]`)
- `xss/no-mixed-html` (High) at `:32` and `:91`
- `no-unnecessary-condition` (High) at `:81` — "value is always falsy"

## Expected Behavior
Rendering output, HTML escaping and the "unknown template" error are unchanged.

## Solution
Look values up through a `Map` (or `Object.hasOwn` guarded reads) instead of bracket access — for example a module-level `Map` for the five HTML escapes and a `Map` built from `variables` for interpolation. Fix the condition at `:81` so it tests something the type actually allows to be absent (or remove it if the type guarantees presence). Do not change `template-registry.ts` (owned by the guarded-reader issue) — accept the registry through its existing type.

## Benefits
Removes six High findings and makes missing-key behaviour explicit rather than relying on `undefined` coercion.

## Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).

