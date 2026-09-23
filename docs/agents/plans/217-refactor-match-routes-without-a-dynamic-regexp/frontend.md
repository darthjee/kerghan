# Frontend Plan: Refactor: Match routes without a dynamic RegExp

Main plan: [plan.md](plan.md)

## Overview
Rewrite `frontend/assets/js/utils/routing/Route.js` so it matches paths segment by segment instead of through `new RegExp(...)`, which clears Codacy's only Error-level finding (`security-node/non-literal-reg-expr` / `security/detect-non-literal-regexp` at `Route.js:31`). The public API (`constructor(path, page)`, `matches(path)`, `params(path)`, `get page()`) is unchanged, so `Router` and `HashRouteResolver` need no edits.

## Context
- Current implementation turns the pattern into `^<segments>/?$`, where `:name` → `(?<name>[^/]+)` and static segments are regex-escaped via `static #escapeRegex`.
- Registered routes (`HashRouteResolver.js` `ROUTES`): `/recover-password`, `/admin/users/:id/edit`, `/admin/users`, `/account/authorization-requests`, `/account/my-account`, `/`. `getPage()` resolves an empty hash as `'/'`.
- `Router.extractParams('/admin/users/:id/edit', hash)` (used by `AdminUserEdit.jsx`) builds a throwaway `Route` and calls `params`, so `params` must keep returning `{}` on no match and a plain `{ name: value }` object on match.

## Implementation Steps

### Step 1 — Replace the RegExp with segment matching in `Route`
In `Route.js`:

- Replace the `#regex` field with `#segments`.
- Add a private static helper (e.g. `static #split(path)`) that does `path.split('/')` and, if the last element is `''` **and** there is more than one element, drops that one trailing element. Use it for both the pattern (constructor) and incoming paths.
  - Pattern `'/'` → `['']`; path `'/'` → `['']`; path `'/games/10/'` → `['', 'games', '10']`.
- Add a private method (e.g. `#match(path)`) returning the params object, or `null` on no match:
  - split the path; if lengths differ → `null`;
  - for each index: if the pattern segment starts with `':'`, the path segment must be non-empty (else `null`) and is stored under `segment.slice(1)`; otherwise the segments must be strictly equal (else `null`);
  - return the collected params.
- `matches(path)` → `this.#match(path) !== null`.
- `params(path)` → `this.#match(path) ?? {}`.
- Delete `static #escapeRegex` and the `eslint-disable-next-line` comment block.
- Keep JSDoc on every method/helper, in the file's existing style.

Avoid dynamic-key object writes that Codacy/ESLint flag as object-injection sinks (recent refactors #212–#214 removed those): build params with `Object.fromEntries` over the collected `[name, value]` pairs rather than `params[name] = value`.

### Step 2 — Extend `RouteSpec`
Keep all existing cases in `frontend/specs/assets/js/utils/routing/RouteSpec.js` unchanged, and add:

- static route with trailing slash matches (`/register/`);
- parameterized route with trailing slash matches and extracts params (`/games/10/` → `{ id: '10' }`);
- root route `'/'` matches `'/'` and does not match `'/other'`;
- empty param segment does not match (`/games/`, `/games//` against `/games/:id`), and `params` returns `{}`;
- extra segments (`/games/10/extra`) and missing segments (`/games`) do not match;
- multi-param / mid-pattern param extraction (`/admin/users/:id/edit` with `/admin/users/5/edit` → `{ id: '5' }`);
- static segment with a regex-special character matches literally (`/v1.0` matches `/v1.0` but not `/v1x0`).

## Files to Change
- `frontend/assets/js/utils/routing/Route.js` — replace RegExp construction with segment matching; drop `#escapeRegex` and the eslint-disable comment.
- `frontend/specs/assets/js/utils/routing/RouteSpec.js` — add the edge-case specs listed above.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)

## Notes
- Known, accepted divergence: the old regex for `'/'` (`^//?$`) also matched `'//'`; the new implementation does not. `Router.resolve` falls back to `'home'` on no match, so the resolved page is unchanged.
- Param values are returned raw (no URI decoding), same as today.
- No changes to `Router.js`, `HashRouteResolver.js` or their specs are expected; run the full frontend suite to confirm.
