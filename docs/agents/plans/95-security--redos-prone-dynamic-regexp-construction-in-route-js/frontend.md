# Frontend Plan: Security: ReDoS-prone dynamic RegExp construction in Route.js

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Register the Codacy-only rule stub

Add a `security-node.non-literal-reg-expr` entry to the `codacyRuleStubs` object in
`frontend/eslint.config.mjs`, alongside the existing `xss`, `security`, and `@typescript-eslint`
stand-ins. This lets ESLint recognize the rule ID referenced by the disable comment in Step 2
(without it, ESLint errors with "Definition for rule ... was not found").

Also add `frontend/assets/js/utils/routing/Route.js` to the `files` list in the third config
block (the one setting `linterOptions: { reportUnusedDisableDirectives: 'off' }`), matching the
existing entries for `AuthSession.js`, `AuthEvents.js`, etc. — this project's own lint run never
enables the stub rules, so the disable comment added in Step 2 would otherwise be flagged as an
unused directive.

### Step 2 — Suppress the finding at its source with a justification comment

In `frontend/assets/js/utils/routing/Route.js`, add a narrowly-scoped
`// eslint-disable-next-line security-node/non-literal-reg-expr -- <reason>` comment directly
above line 27 (`this.#regex = new RegExp(...)`), matching the style of the existing disable
comments in `AuthSession.js`/`AuthEvents.js`/`AdminUsersHelper.jsx`. The justification should
state that `pattern` is built exclusively from statically-escaped literal segments
(`Route.#escapeRegex`) and a bounded `(?<name>[^/]+)` capture group for `:param` segments — never
from external/untrusted input — so no catastrophic backtracking is possible regardless of the
input path.

No other code in `Route.js` changes; routing behavior stays identical.

## Files to Change

- `frontend/eslint.config.mjs` — add the `security-node.non-literal-reg-expr` rule stub; add
  `Route.js` to the `reportUnusedDisableDirectives: off` file list.
- `frontend/assets/js/utils/routing/Route.js` — add the justified `eslint-disable-next-line`
  comment above the `RegExp` construction (line 27).

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`, `npm run
  lint`) — confirms the new disable comment resolves cleanly and no other lint rule regresses.

## Notes

- No test changes expected: `RouteSpec.js`/`RouterSpec.js`/`HashRouteResolverSpec.js` already
  cover matching behavior, which is unchanged by this plan.
- If Codacy's own rule set ever needs to be exercised via the `security-node` plugin directly
  (rather than only through the stub), that plugin isn't installed locally — this plan
  deliberately keeps the stub as a no-op, matching how `security`/`xss`/`@typescript-eslint` stubs
  are already handled in this file.
