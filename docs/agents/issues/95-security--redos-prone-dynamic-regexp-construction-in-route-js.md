# Issue: Security: ReDoS-prone dynamic RegExp construction in Route.js

## Description

Codacy reports an Error-severity `security-node/non-literal-reg-expr` finding at
`frontend/assets/js/utils/routing/Route.js:27`, where a route's regex is built via:

```js
this.#regex = new RegExp(`^${pattern}/?$`);
```

`pattern` is a template-literal (non-literal) string passed to the `RegExp` constructor,
which static analysis generically flags as a possible ReDoS (regular expression denial of
service) vector via catastrophic backtracking.

## Problem

Tracing every caller of `Route`/`Router` (`HashRouteResolver.js`'s hardcoded `ROUTES` table,
`Router.extractParams()` call sites such as `AdminUserEdit.jsx`, and the specs) shows `path` is
always a static, hardcoded string literal — never derived from user input, query strings, or any
runtime/config source.

`Route`'s constructor already builds `pattern` defensively before it reaches `RegExp`:

- Literal path segments are escaped via `Route.#escapeRegex()` (`.replace(/[.*+?^${}()|[\]\\]/g,
  '\\$&')`) before interpolation.
- `:param` segments become a bounded `(?<name>[^/]+)` capture group — a single-character-class
  quantifier with no nesting, so it cannot exhibit catastrophic backtracking regardless of input.

So there is no real ReDoS exposure today: this is a static-analysis false positive. Codacy's
`security-node/non-literal-reg-expr` rule flags any non-literal argument passed to `RegExp`
regardless of whether that argument is escaped/bounded, so it still fires here and remains the
only Error-severity finding on the repo.

## Expected Behavior

Codacy no longer reports an unaddressed Error-severity finding for `Route.js:27`, and the
suppression is scoped and justified narrowly enough that it doesn't blanket-hide a real future
misuse of `RegExp` elsewhere. Routing behavior is unchanged.

## Solution

Follow this project's existing convention for confirmed Codacy false positives (already used for
`security/detect-object-injection` and `@typescript-eslint/no-extraneous-class` in
`frontend/eslint.config.mjs`):

1. Add a `security-node.non-literal-reg-expr` entry to the `codacyRuleStubs` no-op stand-ins in
   `frontend/eslint.config.mjs`, so ESLint recognizes the rule ID referenced below.
2. Add a narrowly-scoped `// eslint-disable-next-line security-node/non-literal-reg-expr --
   <justification>` comment directly above `Route.js:27`, explaining that `pattern` is built
   exclusively from statically-escaped literal segments and a bounded `[^/]+` capture group —
   never from external/untrusted input.
3. Add `frontend/assets/js/utils/routing/Route.js` to the `reportUnusedDisableDirectives: off`
   file list in the same config, matching the existing files there.

No functional/runtime change to `Route.js` beyond the comment — adding input validation or
escaping for a code path that never receives untrusted input would be unneeded defensive code per
this project's conventions.

## Benefits

- Resolves the only Error-severity Codacy finding on the repository.
- Documents, in the code itself, why this `RegExp` construction is safe — useful context for any
  future contributor who reconsiders this rule.
- Avoids adding unnecessary validation/escaping overhead to a route-matching path that only ever
  receives static, developer-authored patterns.
