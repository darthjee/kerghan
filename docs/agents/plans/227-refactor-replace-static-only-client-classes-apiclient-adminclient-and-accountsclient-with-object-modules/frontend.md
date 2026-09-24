# Frontend Plan: Refactor: Replace static-only client classes ApiClient, AdminClient and AccountsClient with object modules

Main plan: [plan.md](plan.md)

## Overview
Replace `ApiClient`, `AdminClient` and `AccountsClient` with plain exported object literals
following the "Helper module shape" convention in `.claude/agents/frontend.md`, keeping every
caller (`ApiClient.postJson(...)` etc.) and every spec spy (`spyOn(ApiClient, 'postJson')`)
working unchanged.

## Context
Codacy reports `@typescript-eslint/no-extraneous-class` (3 Warnings) on these files even though
the rule is stubbed in `frontend/eslint.config.mjs` and each class carries an
`eslint-disable-next-line` comment. `ApiClient.js` and `AccountsClient.js` are also excluded from
PMD in `.codacy.yml` only because PMD misparses `static async #method` syntax (issue #30), which
disappears with this change. `AuthSession`, `AuthEvents`, `LoginModalEvents` (#228) and
`ApiError` (a real `Error` subclass) are out of scope.

## Steps

- [01 — Convert ApiClient to an object module](frontend/01-convert-apiclient.md)
- [02 — Convert AdminClient and AccountsClient to object modules](frontend/02-convert-adminclient-accountsclient.md)
- [03 — Drop obsolete PMD exclusions from .codacy.yml](frontend/03-drop-pmd-exclusions.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)

## Notes
- Do not use `Object.freeze`, and do not switch callers to namespace imports: Jasmine spies need
  writable properties on the default-exported object.
- Inside `AdminClient` / `AccountsClient`, keep calling `ApiClient.xxx(...)` through the exported
  object (not destructured references) so spies in `AdminClientSpec.js`, `AccountsClientSpec.js`
  and `AccountsClientAuthorizationRequestsSpec.js` still intercept. Same for `AccountsClient`
  methods that call sibling methods: go through `AccountsClient.xxx`, not `this`.
- No spec should need assertion changes; if one does, that signals a behaviour change and should
  be investigated rather than adapted.
- Step 03 touches the root-level `.codacy.yml`, outside the frontend agent's `frontend/` scope;
  it is a two-line config cleanup tied directly to this change, so it ships in the same PR (the
  architect may apply it if the frontend agent should not edit root files).
- `.claude/agents/frontend.md` already prescribes object modules; its "being migrated
  (#227–#230)" note stays accurate while #228–#230 remain open, so no change is needed there.
- Coverage must not drop: the module-level functions are exercised through the same public
  methods the existing `ApiClientSpec.js` already covers.
