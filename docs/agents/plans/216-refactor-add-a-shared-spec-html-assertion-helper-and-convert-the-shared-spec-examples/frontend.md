# Frontend Plan: Refactor: Add a shared spec HTML-assertion helper and convert the shared spec examples

Main plan: [plan.md](plan.md)

## Overview
This is the pilot for removing Codacy's `xss/no-mixed-html` findings from specs. Add a small wrapper helper that renders a React element once and answers questions about the result. Convert `accountEditFormHelperExamples.js`, `accountEditPageExamples.js` and the two specs that consume `renderHtml` to it. Then check the result with the real rule before the six dependent issues reuse the approach.

## Context
- Codacy reports 20 High findings in the two support files: "HTML passed in to function 'expect'" and "Unencoded return value from function `renderToStaticMarkup`/`renderHtml`".
- The rule is a naming heuristic:
  - Identifiers matching `html` (for example `html`, `renderHtml`) passed into functions not named like HTML are flagged.
  - Values returned by known markup producers (`renderToStaticMarkup`, `markup`, `render`) and stored in non-HTML-named places are flagged.
- The repo's ESLint only stubs the rule (`codacyRuleStubs` in `frontend/eslint.config.mjs`), so local lint cannot catch it. Codacy ignores inline disables.
- Decisions made in the issue discussion:
  - Use a string wrapper, with **no** DOM library.
  - Also change the returned `renderHtml` API and its callers.
  - Verify with a one-off local run of the real rule. Nothing gets committed for this run.

## Steps

- [01 — Add the rendered-output assertion helper](frontend/01-add-assertion-helper.md)
- [02 — Convert the shared examples and their callers](frontend/02-convert-shared-examples.md)
- [03 — Verify with the real no-mixed-html rule](frontend/03-verify-no-mixed-html.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)

## Notes
- The shared examples must keep the same assertions with the same pass/fail results. This is a pure refactor, and the number of specs should not change.
- If step 03 shows the rule firing (including on the helper's own internals), stop. Record the output and a revised approach in the PR description instead of adding per-file workarounds. The dependent issues must not proceed on an unproven approach.
- `accountEditFormControllerExamples.js` is out of scope.
- Issue #181 (the shared `AccountEditFormHelper`) has already landed, so the helpers under test are stable.
